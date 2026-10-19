import type { ImageMetadata } from 'astro';

import panoInsert from '../assets/photos/pano-insert-stone-wall.jpg';
import panoWhite from '../assets/photos/pano-white-modern.jpg';
import panoLounge from '../assets/photos/pano-gas-lounge.jpg';
import panoLiving from '../assets/photos/pano-gas-living-room.jpg';
import panoDining from '../assets/photos/pano-gas-dining.jpg';
import panoMinimal from '../assets/photos/pano-gas-minimal.jpg';
import panoOutdoor from '../assets/photos/pano-outdoor-stone.jpg';
import panoWoodStoves from '../assets/photos/pano-wood-stoves.jpg';
import panoWood from '../assets/photos/pano-wood-fireplace.jpg';
import panoStone from '../assets/photos/pano-cultured-stone-home.jpg';
import woodStone from '../assets/photos/wood-fireplace-stone.jpg';
import seeThrough from '../assets/photos/gas-see-through.jpg';
import electricModern from '../assets/photos/electric-wall-modern.jpg';
import electricLounge from '../assets/photos/electric-wall-lounge.jpg';
import electricLinear from '../assets/photos/electric-linear.jpg';
import gasInsert from '../assets/photos/gas-insert.jpg';
import pellet from '../assets/photos/pellet-insert.jpg';
import gasLogs from '../assets/photos/gas-logs.jpg';
import mantel from '../assets/photos/mantel-traditional.jpg';
import doors from '../assets/photos/fireplace-doors.jpg';
import accessories from '../assets/photos/hearth-accessories.jpg';
import outdoorWall from '../assets/photos/outdoor-stone-fireplace.jpg';
import stoneSamples from '../assets/photos/stone-samples.jpg';

export type GalleryTag = 'Gas' | 'Wood' | 'Electric' | 'Pellet' | 'Inserts' | 'Stoves' | 'Outdoor' | 'Mantels & Stone';

export interface GalleryItem {
  src: ImageMetadata;
  title: string;
  alt: string;
  tags: GalleryTag[];
  /** Layout hint for the masonry grid */
  wide?: boolean;
  tall?: boolean;
  position?: string;
}

/**
 * Inspiration photos from the current site (mostly manufacturer imagery).
 * TODO: replace or supplement with real HMI installation photos — the current
 * site's "Past & Present Projects" page says "Coming soon".
 */
export const gallery: GalleryItem[] = [
  { src: panoInsert, title: 'Insert in a slate feature wall', alt: 'Fireplace insert glowing in a blue-gray slate wall beneath a wood mantel', tags: ['Gas', 'Inserts'], wide: true },
  { src: woodStone, title: 'Arched wood fireplace in stone', alt: 'Arched wood-burning fireplace set in tan stone beside a leather sofa', tags: ['Wood', 'Mantels & Stone'] },
  { src: seeThrough, title: 'See-through gas fireplace', alt: 'See-through gas fireplace with a realistic log set and brick panels', tags: ['Gas'] },
  { src: panoWhite, title: 'Clean-face modern fireplace', alt: 'Square modern fireplace set into a white wall in a bright room', tags: ['Gas'], wide: true, position: '45% 50%' },
  { src: mantel, title: 'Traditional carved mantel', alt: 'Dark carved-wood mantel framing an arched fireplace', tags: ['Mantels & Stone', 'Wood'], tall: true },
  { src: electricModern, title: 'Wall-mounted linear electric', alt: 'Linear electric fireplace mounted on a white wall near a lounge chair', tags: ['Electric'] },
  { src: panoOutdoor, title: 'Stacked-stone outdoor fireplace', alt: 'Outdoor fireplace built into a long stacked-stone wall', tags: ['Outdoor', 'Mantels & Stone'], wide: true },
  { src: gasInsert, title: 'Gas insert in brick', alt: 'Gas insert with a black surround in a brick fireplace with wood pilasters', tags: ['Gas', 'Inserts'] },
  { src: panoWoodStoves, title: 'Freestanding wood stoves', alt: 'Two contemporary wood stoves on stone hearths', tags: ['Wood', 'Stoves'], wide: true, position: '50% 60%' },
  { src: electricLounge, title: 'Media-wall electric fireplace', alt: 'Electric fireplace glowing on a dark wall above a cozy seating area', tags: ['Electric'] },
  { src: pellet, title: 'Pellet insert in fieldstone', alt: 'Pellet insert with a cast-iron surround in a rustic stone fireplace', tags: ['Pellet', 'Inserts', 'Mantels & Stone'] },
  { src: panoLounge, title: 'Gas fireplace in a sunlit lounge', alt: 'Gas fireplace between two seating areas in a bright, elegant room', tags: ['Gas'], wide: true },
  { src: doors, title: 'Arched glass fireplace doors', alt: 'Black arched fireplace doors in a white paneled mantel', tags: ['Mantels & Stone'], tall: true },
  { src: gasLogs, title: 'Hand-painted gas logs', alt: 'Close-up of a realistic gas log set with tall flames', tags: ['Gas'] },
  { src: panoDining, title: 'Fireplace beside the dining table', alt: 'Gas fireplace in a white wall beside a glass dining table and brick accent', tags: ['Gas'], wide: true },
  { src: electricLinear, title: 'Linear electric with accent lighting', alt: 'Wide linear electric fireplace with blue accent lighting', tags: ['Electric'] },
  { src: accessories, title: 'Tool set & log holder', alt: 'Wrought-iron fireplace tools and log holder on a polished hearth', tags: ['Mantels & Stone'], tall: true, position: '60% 50%' },
  { src: panoLiving, title: 'Living-room gas fireplace', alt: 'Gas fireplace glowing in a cozy living room', tags: ['Gas'], wide: true },
  { src: outdoorWall, title: 'Outdoor fireplace wall', alt: 'Outdoor fireplace in a stacked-stone wall on a green lawn', tags: ['Outdoor', 'Mantels & Stone'] },
  { src: panoMinimal, title: 'Minimalist gas fireplace', alt: 'Gas fireplace in a minimal white room with a vase of greenery', tags: ['Gas'], wide: true, position: '70% 50%' },
  { src: stoneSamples, title: 'Stone veneer profiles', alt: 'Stone veneer samples in gray, tan and brown', tags: ['Mantels & Stone'] },
  { src: panoWood, title: 'Stone-wall wood fireplace', alt: 'Wood fireplace in a gray stone wall in a bright living room', tags: ['Wood', 'Mantels & Stone'], wide: true },
  { src: panoStone, title: 'Stone veneer exterior', alt: 'Two-story home with stone veneer accents', tags: ['Mantels & Stone', 'Outdoor'], wide: true },
];

export const galleryTags: GalleryTag[] = ['Gas', 'Wood', 'Electric', 'Pellet', 'Inserts', 'Stoves', 'Outdoor', 'Mantels & Stone'];
