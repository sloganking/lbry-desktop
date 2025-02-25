// @flow
import { URL } from 'config';
import { remote } from 'electron';
import React, { Suspense, Fragment } from 'react';
import classnames from 'classnames';
import LoadingScreen from 'component/common/loading-screen';
import VideoViewer from 'component/viewers/videoViewer';
import ImageViewer from 'component/viewers/imageViewer';
import AppViewer from 'component/viewers/appViewer';
import Button from 'component/button';
import { withRouter } from 'react-router-dom';
import AutoplayCountdown from 'component/autoplayCountdown';
import { formatLbryUrlForWeb } from 'util/url';
// @if TARGET='web'
import { generateStreamUrl } from 'util/lbrytv';
// @endif

import path from 'path';
import fs from 'fs';
import Yrbl from 'component/yrbl';

import DocumentViewer from 'component/viewers/documentViewer';
import PdfViewer from 'component/viewers/pdfViewer';
import HtmlViewer from 'component/viewers/htmlViewer';
// @if TARGET='app'
import DocxViewer from 'component/viewers/docxViewer';
import ComicBookViewer from 'component/viewers/comicBookViewer';
import ThreeViewer from 'component/viewers/threeViewer';
// @endif

type Props = {
  uri: string,
  mediaType: string,
  isText: true,
  streamingUrl: string,
  embedded?: boolean,
  contentType: string,
  claim: StreamClaim,
  currentTheme: string,
  downloadPath: string,
  fileName: string,
  autoplay: boolean,
  setPlayingUri: (string | null) => void,
  currentlyFloating: boolean,
  thumbnail: string,
};

type State = {
  showAutoplayCountdown: boolean,
  showEmbededMessage: boolean,
};

class FileRender extends React.PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {
      showAutoplayCountdown: false,
      showEmbededMessage: false,
    };

    (this: any).escapeListener = this.escapeListener.bind(this);
    (this: any).onEndedAutoplay = this.onEndedAutoplay.bind(this);
    (this: any).onEndedEmbedded = this.onEndedEmbedded.bind(this);
    (this: any).getOnEndedCb = this.getOnEndedCb.bind(this);
  }

  componentDidMount() {
    window.addEventListener('keydown', this.escapeListener, true);
  }

  componentWillUnmount() {
    window.removeEventListener('keydown', this.escapeListener, true);
  }

  escapeListener(e: SyntheticKeyboardEvent<*>) {
    if (e.keyCode === 27) {
      e.preventDefault();

      this.exitFullscreen();

      return false;
    }
  }

  exitFullscreen() {
    remote.getCurrentWindow().setFullScreen(false);
  }

  getOnEndedCb() {
    const { setPlayingUri, currentlyFloating, embedded } = this.props;

    if (embedded) {
      return this.onEndedEmbedded;
    }

    if (!currentlyFloating) {
      return this.onEndedAutoplay;
    }

    return () => setPlayingUri(null);
  }

  onEndedAutoplay() {
    const { autoplay } = this.props;
    if (autoplay) {
      this.setState({ showAutoplayCountdown: true });
    }
  }

  onEndedEmbedded() {
    this.setState({ showEmbededMessage: true });
  }

  renderViewer() {
    const { mediaType, currentTheme, claim, contentType, downloadPath, fileName, streamingUrl, uri } = this.props;
    const fileType = fileName && path.extname(fileName).substring(1);

    // Ideally the lbrytv api server would just replace the streaming_url returned by the sdk so we don't need this check
    // https://github.com/lbryio/lbrytv/issues/51
    const source = IS_WEB ? generateStreamUrl(claim.name, claim.claim_id) : streamingUrl;

    // Human-readable files (scripts and plain-text files)
    const readableFiles = ['text', 'document', 'script'];

    // Supported mediaTypes
    const mediaTypes = {
      // @if TARGET='app'
      '3D-file': <ThreeViewer source={{ fileType, downloadPath }} theme={currentTheme} />,
      'comic-book': <ComicBookViewer source={{ fileType, downloadPath }} theme={currentTheme} />,
      application: <AppViewer uri={uri} />,
      // @endif

      video: <VideoViewer uri={uri} source={source} contentType={contentType} onEndedCB={this.getOnEndedCb()} />,
      audio: <VideoViewer uri={uri} source={source} contentType={contentType} onEndedCB={this.getOnEndedCb()} />,
      image: <ImageViewer uri={uri} source={source} />,
      // Add routes to viewer...
    };

    // Supported contentTypes
    const contentTypes = {
      'application/x-ext-mkv': (
        <VideoViewer uri={uri} source={source} contentType={contentType} onEndedCB={this.getOnEndedCb()} />
      ),
      'video/x-matroska': (
        <VideoViewer uri={uri} source={source} contentType={contentType} onEndedCB={this.getOnEndedCb()} />
      ),
      'application/pdf': <PdfViewer source={downloadPath || source} />,
      'text/html': <HtmlViewer source={downloadPath || source} />,
      'text/htm': <HtmlViewer source={downloadPath || source} />,
    };

    // Supported fileType
    const fileTypes = {
      // @if TARGET='app'
      docx: <DocxViewer source={downloadPath} />,
      // @endif
      // Add routes to viewer...
    };

    // Check for a valid fileType, mediaType, or contentType
    let viewer = (fileType && fileTypes[fileType]) || mediaTypes[mediaType] || contentTypes[contentType];

    // Check for Human-readable files
    if (!viewer && readableFiles.includes(mediaType)) {
      viewer = (
        <DocumentViewer
          source={{
            // @if TARGET='app'
            file: options => fs.createReadStream(downloadPath, options),
            // @endif
            stream: source,
            fileType,
            contentType,
          }}
          theme={currentTheme}
        />
      );
    }

    // @if TARGET='web'
    // temp workaround to disabled paid content on web
    if (claim && claim.value.fee && Number(claim.value.fee.amount) > 0) {
      const paidMessage = __(
        'Currently, only free content is available on lbry.tv. Try viewing it in the desktop app.'
      );
      const paid = <LoadingScreen status={paidMessage} spinner={false} />;
      return paid;
    }
    // @endif

    const unsupported = IS_WEB ? (
      <div className={'content__cover--disabled'}>
        <Yrbl
          className={'content__cover--disabled'}
          title={'Not available on lbry.tv'}
          subtitle={
            <Fragment>
              <p>
                {__('Good news, though! You can')}{' '}
                <Button button="link" label={__('Download the desktop app')} href="https://lbry.com/get" />{' '}
                {'and have access to all file types.'}
              </p>
            </Fragment>
          }
          uri={uri}
        />
      </div>
    ) : (
      <div className={'content__cover--disabled'}>
        <Yrbl
          title={'Content Downloaded'}
          subtitle={'This file is unsupported here, but you can view the content in an application of your choice'}
          uri={uri}
        />
      </div>
    );

    // Return viewer
    return viewer || unsupported;
  }
  render() {
    const { isText, uri, currentlyFloating, embedded } = this.props;
    const { showAutoplayCountdown, showEmbededMessage } = this.state;
    const lbrytvLink = `${URL}${formatLbryUrlForWeb(uri)}?src=embed`;

    return (
      <div
        className={classnames({
          'file-render': !embedded,
          'file-render--document': isText && !embedded,
          'file-render__embed': embedded,
        })}
      >
        {embedded && showEmbededMessage && (
          <div className="video-overlay__wrapper">
            <div className="video-overlay__title">{__('See more on lbry.tv')}</div>

            <div className="video-overlay__actions">
              <div className="section__actions--centered">
                <Button label={__('Explore')} button="primary" href={lbrytvLink} />
              </div>
            </div>
          </div>
        )}
        {!currentlyFloating && showAutoplayCountdown && <AutoplayCountdown uri={uri} />}
        <Suspense fallback={<div />}>{this.renderViewer()}</Suspense>
      </div>
    );
  }
}

export default withRouter(FileRender);
