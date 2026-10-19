export interface Video {
  id: string;
  provider: 'youtube' | 'vimeo';
  title: string;
  /** Seconds, when known */
  duration?: number;
}

/**
 * Videos embedded on the current site that still resolve publicly.
 * Three other YouTube embeds (BEMclJONFJA, ZKVq-oZLSFE, iee2VhpqFRI) no longer
 * return metadata and were left out. TODO: confirm with HMI.
 */
export const videos = {
  vermontCastings: { id: '1219335694', provider: 'vimeo', title: 'Vermont Castings at HMI Fireplace Shops' },
  feature: { id: '988541313', provider: 'vimeo', title: 'HMI Fireplace Shops — feature', duration: 221 },
  batteryBackup: { id: '900216349', provider: 'vimeo', title: 'Battery backup help', duration: 49 },
  mezzo: { id: 'iGz6dqPFW1E', provider: 'youtube', title: 'Mezzo series product video' },
  jingle: { id: 'HJlrFzScR2s', provider: 'youtube', title: 'The HMI Fireplace Shop jingle' },
} satisfies Record<string, Video>;
