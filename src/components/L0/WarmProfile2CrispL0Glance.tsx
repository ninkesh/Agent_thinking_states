/**
 * WarmProfile2CrispL0Glance — warm_profile_2_crisp route only.
 *
 * Identical to WarmProfile1CrispL0Glance except uses WARM_PROFILE_2_SIGNAL_DATA_CRISP
 * and falls back to ColdStartL0Glance for unmapped items.
 */
import type { FeedItem, PreferenceProfile } from '../../data/types';
import { getGlanceConfig } from '../../config/glanceConfig';
import ColdStartL0Glance from './ColdStartL0Glance';
import WarmProfile1CinematicL0 from './WarmProfile1CinematicL0';
import { WARM_PROFILE_2_SIGNAL_DATA_CRISP } from './warmProfile2SignalDataCrisp';

type Props = {
  item:               FeedItem;
  profile:            PreferenceProfile;
  paused?:            boolean;
  onCTAClick:         () => void;
  onTimelineComplete: () => void;
};

export default function WarmProfile2CrispL0Glance({ item, profile, paused = false, onCTAClick, onTimelineComplete }: Props) {
  const signalData = WARM_PROFILE_2_SIGNAL_DATA_CRISP[item.id];

  if (signalData) {
    const config     = getGlanceConfig(item);
    const alignment  = config.layout;
    const bgEntrance = 'zoom-dissolve' as const;

    return (
      <WarmProfile1CinematicL0
        key={item.id}
        item={item}
        paused={paused}
        ctaFocused={false}
        onCTAClick={onCTAClick}
        alignment={alignment}
        onTimelineComplete={onTimelineComplete}
        signalData={signalData}
        bgEntrance={bgEntrance}
      />
    );
  }

  return (
    <ColdStartL0Glance
      key={item.id}
      item={item}
      profile={profile}
      paused={paused}
      onCTAClick={onCTAClick}
      onTimelineComplete={onTimelineComplete}
    />
  );
}
