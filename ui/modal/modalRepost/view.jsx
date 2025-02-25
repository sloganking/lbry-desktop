// @flow
import * as ICONS from 'constants/icons';
import { CHANNEL_NEW, MINIMUM_PUBLISH_BID, INVALID_NAME_ERROR } from 'constants/claim';
import React from 'react';
import { Modal } from 'modal/modal';
import Card from 'component/common/card';
import Button from 'component/button';
import SelectChannel from 'component/selectChannel';
import ErrorText from 'component/common/error-text';
import { FormField } from 'component/common/form';
import { parseURI, isNameValid, creditsToString } from 'lbry-redux';
import usePersistedState from 'effects/use-persisted-state';
import I18nMessage from 'component/i18nMessage';
import analytics from 'analytics';

type Props = {
  doHideModal: () => void,
  doToast: ({ message: string }) => void,
  doClearRepostError: () => void,
  doRepost: StreamRepostOptions => Promise<*>,
  title: string,
  claim: ?StreamClaim,
  balance: number,
  channels: ?Array<ChannelClaim>,
  myClaims: ?Array<StreamClaim>,
  doFetchClaimListMine: () => void,
  error: ?string,
  reposting: boolean,
};

function ModalRepost(props: Props) {
  const {
    doHideModal,
    doToast,
    doClearRepostError,
    doRepost,
    title,
    claim,
    balance,
    channels,
    error,
    reposting,
    myClaims,
    doFetchClaimListMine,
  } = props;
  const defaultName = claim && claim.name;
  const contentClaimId = claim && claim.claim_id;
  const [repostChannel, setRepostChannel] = usePersistedState('repost-channel');
  const [repostBid, setRepostBid] = React.useState(0.01);
  const [showAdvanced, setShowAdvanced] = React.useState();
  const [repostName, setRepostName] = React.useState(defaultName);

  let repostBidError;
  if (repostBid === 0) {
    repostBidError = __('Deposit cannot be 0');
  } else if (balance === repostBid) {
    repostBidError = __('Please decrease your deposit to account for transaction fees');
  } else if (balance < repostBid) {
    repostBidError = __('Deposit cannot be higher than your balance');
  } else if (repostBid < MINIMUM_PUBLISH_BID) {
    repostBidError = __('Your deposit must be higher');
  }

  let repostNameError;
  if (!repostName) {
    repostNameError = __('A name is required');
  } else if (!isNameValid(repostName, false)) {
    repostNameError = INVALID_NAME_ERROR;
  } else if (
    channels &&
    channels.find(claim => claim.name === repostChannel) &&
    myClaims &&
    myClaims.find(claim => claim.name === repostName)
  ) {
    repostNameError = __('You already have a claim with this name.');
  }

  React.useEffect(() => {
    if ((repostNameError || repostNameError) && !showAdvanced) {
      setShowAdvanced(true);
    }
  }, [repostBidError, repostNameError, showAdvanced, setShowAdvanced]);

  const channelStrings = channels && channels.map(channel => channel.permanent_url).join(',');
  React.useEffect(() => {
    if (!repostChannel && channelStrings) {
      const channels = channelStrings.split(',');
      const newChannelUrl = channels[0];
      const { claimName } = parseURI(newChannelUrl);
      setRepostChannel(claimName);
    }
  }, [channelStrings]);

  const myClaimsString = myClaims && myClaims.map(channel => channel.permanent_url).join(',');
  React.useEffect(() => {
    if (myClaimsString === '') {
      doFetchClaimListMine();
    }
  }, [myClaimsString, doFetchClaimListMine]);

  function handleSubmit() {
    const channelToRepostTo = channels && channels.find(channel => channel.name === repostChannel);
    if (channelToRepostTo && repostName && repostBid && repostChannel && contentClaimId) {
      doRepost({
        name: repostName,
        bid: creditsToString(repostBid),
        channel_id: channelToRepostTo.claim_id,
        claim_id: contentClaimId,
      }).then((repostClaim: StreamClaim) => {
        analytics.apiLogPublish(repostClaim);
        doHideModal();
        doToast({ message: __('Woohoo! Successfully reposted this claim.') });
      });
    }
  }

  function handleCloseModal() {
    doClearRepostError();
    doHideModal();
  }

  return (
    <Modal isOpen type="card" onAborted={handleCloseModal} onConfirmed={handleCloseModal}>
      <Card
        actionIconPadding={false}
        icon={ICONS.REPOST}
        title={
          <span>
            Repost <em>{title}</em>
          </span>
        }
        subtitle={
          error ? (
            <ErrorText>{__('There was an error reposting this claim. Please try again later.')}</ErrorText>
          ) : (
            <span>{__('Repost your favorite claims to help more people discover them!')}</span>
          )
        }
        actions={
          <div>
            <SelectChannel
              label="Channel to repost on"
              hideAnon
              channel={repostChannel}
              onChannelChange={newChannel => setRepostChannel(newChannel)}
            />
            {!showAdvanced && (
              <div className="section__actions">
                <Button button="link" label={__('Advanced')} onClick={() => setShowAdvanced(true)} />
              </div>
            )}

            {showAdvanced && (
              <React.Fragment>
                <fieldset-section>
                  <fieldset-group class="fieldset-group--smushed fieldset-group--disabled-prefix">
                    <fieldset-section>
                      <label>{__('Name')}</label>
                      <div className="form-field__prefix">{`lbry://${
                        !repostChannel || repostChannel === CHANNEL_NEW ? '' : `${repostChannel}/`
                      }`}</div>
                    </fieldset-section>
                    <FormField
                      type="text"
                      name="repost_name"
                      value={repostName}
                      error={repostNameError}
                      onChange={event => setRepostName(event.target.value)}
                    />
                  </fieldset-group>
                </fieldset-section>

                <div className="form-field__help">
                  <I18nMessage
                    tokens={{
                      lbry_naming_link: (
                        <Button button="link" label={__('community name')} href="https://lbry.com/faq/naming" />
                      ),
                    }}
                  >
                    Change this to repost to a different %lbry_naming_link%.
                  </I18nMessage>
                </div>

                <FormField
                  type="number"
                  name="repost_bid"
                  min="0"
                  step="any"
                  placeholder="0.123"
                  className="form-field--price-amount"
                  label={__('Deposit (LBC)')}
                  postfix="LBC"
                  value={repostBid}
                  error={repostBidError}
                  disabled={!repostName}
                  onChange={event => setRepostBid(parseFloat(event.target.value))}
                  onWheel={e => e.stopPropagation()}
                />
              </React.Fragment>
            )}

            <div className="section__actions">
              <Button
                disabled={reposting || repostBidError || repostNameError}
                button="primary"
                label={reposting ? __('Reposting') : __('Repost')}
                onClick={handleSubmit}
              />
              <Button button="link" label={__('Cancel')} onClick={handleCloseModal} />
            </div>
          </div>
        }
      />
    </Modal>
  );
}

export default ModalRepost;
