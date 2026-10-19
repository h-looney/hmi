import type { ImageMetadata } from 'astro';

import woodFireplaceStone from '../assets/photos/wood-fireplace-stone.jpg';
import panoWoodFireplace from '../assets/photos/pano-wood-fireplace.jpg';
import gasSeeThrough from '../assets/photos/gas-see-through.jpg';
import panoGasLivingRoom from '../assets/photos/pano-gas-living-room.jpg';
import electricWallModern from '../assets/photos/electric-wall-modern.jpg';
import outdoorStone from '../assets/photos/outdoor-stone-fireplace.jpg';
import panoOutdoor from '../assets/photos/pano-outdoor-stone.jpg';
import panoGasMinimal from '../assets/photos/pano-gas-minimal.jpg';
import gasLogs from '../assets/photos/gas-logs.jpg';
import gasInsert from '../assets/photos/gas-insert.jpg';
import panoInsert from '../assets/photos/pano-insert-stone-wall.jpg';
import stoveWood from '../assets/photos/stove-wood-cast-iron.png';
import panoWoodStoves from '../assets/photos/pano-wood-stoves.jpg';
import stoveGas from '../assets/photos/stove-gas-cast-iron.png';
import pelletInsert from '../assets/photos/pellet-insert.jpg';
import mantel from '../assets/photos/mantel-traditional.jpg';
import doors from '../assets/photos/fireplace-doors.jpg';
import stoneSamples from '../assets/photos/stone-samples.jpg';
import panoStoneHome from '../assets/photos/pano-cultured-stone-home.jpg';
import accessories from '../assets/photos/hearth-accessories.jpg';
import { withBase } from '../scripts/url';

export type Fuel = 'wood' | 'gas' | 'electric' | 'pellet';
export type GroupId = 'fireplaces' | 'inserts-stoves' | 'hearth-home';

export interface Photo {
  src: ImageMetadata;
  alt: string;
  /** CSS object-position, for crops of panoramic images */
  position?: string;
  /** Transparent product cut-out (rendered on a soft backdrop, not cropped) */
  cutout?: boolean;
}

export interface Category {
  slug: string;
  group: GroupId;
  name: string;
  short: string;
  lead: string;
  overview: string[];
  fuels: Fuel[];
  outdoor?: boolean;
  /** Works with an existing fireplace opening */
  retrofit?: boolean;
  card: Photo;
  /** Panoramic hero (15:4). When absent, the split hero uses `card`. */
  hero?: Photo;
  highlights: { title: string; text: string }[];
  options: string[];
  subtypes?: { name: string; text: string; brands: string[] }[];
  brands: string[];
  tips?: { title: string; text: string; link?: { label: string; href: string } }[];
  faqs?: string[];
  related: string[];
}

export const groups: { id: GroupId; name: string; blurb: string }[] = [
  {
    id: 'fireplaces',
    name: 'Fireplaces',
    blurb: 'Built-in wood, gas and electric fireplaces, outdoor fire and log sets.',
  },
  {
    id: 'inserts-stoves',
    name: 'Inserts & Stoves',
    blurb: 'Upgrade an existing fireplace or add a freestanding heat source.',
  },
  {
    id: 'hearth-home',
    name: 'Hearth & Home',
    blurb: 'Mantels, doors, stone and the accessories that finish the look.',
  },
];

export const categories: Category[] = [
  /* ------------------------------------------------------------------ */
  {
    slug: 'wood-fireplaces',
    group: 'fireplaces',
    name: 'Wood-Burning Fireplaces',
    short: 'Real crackle, real glow. Built-in wood fireplaces in classic and contemporary styles.',
    lead: 'There is nothing quite like a real wood fire. Today’s factory-built wood fireplaces keep everything you love about the experience — and burn cleaner, heat better and fit in more places than the fireplaces you grew up with.',
    overview: [
      'Whether you’re framing a new lake house or reworking a living room, we’ll help you choose a wood fireplace that suits the way you live — from a traditional open hearth for weekend ambiance to a high-efficiency, closed-door unit that can carry real heating load through a Missouri winter.',
      'Lightweight masonry-style kits make a classic stone fireplace possible even on upper floors, and nearly every model can be finished with the stone, mantels and doors you’ll find in our showrooms.',
    ],
    fuels: ['wood'],
    card: { src: woodFireplaceStone, alt: 'Arched wood-burning fireplace set in a tan stone wall beside a leather sofa' },
    hero: { src: panoWoodFireplace, alt: 'Wood fireplace in a gray stone wall anchoring a bright living room', position: '50% 50%' },
    highlights: [
      { title: 'The real thing', text: 'Crackling logs, dancing flames and that unmistakable wood-fire aroma.' },
      { title: 'Heat when the power’s out', text: 'A wood fire doesn’t need electricity to keep your family warm.' },
      { title: 'Cleaner burning', text: 'Modern high-efficiency designs burn more completely, with less smoke and fewer trips to the woodpile.' },
      { title: 'Built around your room', text: 'Traditional or contemporary, indoors or out, with finishing options to match.' },
    ],
    options: [
      'Open-hearth & clean-face designs',
      'High-efficiency heating models',
      'Brick & refractory interiors',
      'Outside-air kits',
      'Blower kits',
      'Glass doors & screens',
    ],
    brands: ['heat-glo', 'heatilator', 'quadra-fire', 'fireplace-x', 'hearthstone', 'kozy-heat', 'mason-lite'],
    tips: [
      {
        title: 'Plan the chimney early',
        text: 'Wood fireplaces need a properly sized chimney system. Building new? Bring us in before framing so clearances and chase dimensions are right the first time.',
      },
    ],
    faqs: ['which-fuel', 'annual-service', 'builders'],
    related: ['gas-fireplaces', 'fireplace-inserts', 'wood-stoves', 'mantels-surrounds'],
  },
  /* ------------------------------------------------------------------ */
  {
    slug: 'gas-fireplaces',
    group: 'fireplaces',
    name: 'Gas Fireplaces',
    short: 'Instant flame at the touch of a button — in styles from rustic to sleek linear.',
    lead: 'All the warmth and ambiance of a fire with none of the hauling, stacking or sweeping. Tap a remote or flip a switch and enjoy a beautiful flame in seconds.',
    overview: [
      'Our direct-vent gas fireplaces draw combustion air from outside and send exhaust back out, so the fire stays sealed off from the air you breathe while the heat stays in the room.',
      'Choose a traditional log set behind brick, a contemporary linear burner over glass media, or a see-through unit that warms two rooms at once. Add a blower, a wall switch or a smart remote — we’ll coordinate the venting, gas and finish work.',
    ],
    fuels: ['gas'],
    card: { src: gasSeeThrough, alt: 'See-through gas fireplace with a lifelike log set and brick interior' },
    hero: { src: panoGasLivingRoom, alt: 'Gas fireplace glowing in a cozy living room with a sofa and throw pillows', position: '50% 55%' },
    highlights: [
      { title: 'Push-button ambiance', text: 'Remote, wall switch or thermostat control. No kindling required.' },
      { title: 'Sealed, efficient design', text: 'Direct-vent units use outside air for combustion, protecting indoor air quality.' },
      { title: 'Natural gas or propane', text: 'Most models run on either fuel — ideal for lake homes on propane.' },
      { title: 'Endless styles', text: 'Traditional, linear, see-through, corner and multi-sided designs.' },
    ],
    options: [
      'Linear & traditional',
      'See-through & multi-sided',
      'Brick, reflective & glass interiors',
      'Logs, stones or glass media',
      'Blowers & fans',
      'Remote & wall controls',
      'Battery-backup ignition',
    ],
    brands: ['heat-glo', 'heatilator', 'quadra-fire', 'fireplace-x', 'kozy-heat', 'montigo', 'davinci', 'monessen', 'empire', 'hearthstone'],
    tips: [
      {
        title: 'Power outage?',
        text: 'Many gas fireplaces can still light during an outage with a battery backup. Ask us which ignition system fits how you’ll use it.',
        link: { label: 'Battery backup help', href: withBase('/resources/#battery-backup') },
      },
      {
        title: 'Compare operating costs',
        text: 'See how natural gas and propane stack up against wood, pellets and electricity at today’s prices.',
        link: { label: 'Fuel cost calculator', href: withBase('/fireplace-finder/#calculator') },
      },
    ],
    faqs: ['power-outage', 'which-fuel', 'annual-service'],
    related: ['gas-logs', 'fireplace-inserts', 'vent-free-gas', 'mantels-surrounds'],
  },
  /* ------------------------------------------------------------------ */
  {
    slug: 'electric-fireplaces',
    group: 'fireplaces',
    name: 'Electric Fireplaces',
    short: 'No chimney, no gas line, no venting. Realistic flame effects almost anywhere.',
    lead: 'Electric fireplaces bring a convincing flame and comfortable supplemental heat to rooms where venting a fire isn’t practical — condos, apartments, finished basements, bedrooms and offices.',
    overview: [
      'With nothing to vent, an electric fireplace can go nearly anywhere: recessed into a wall, built into a media console or cabinet mantel, or slipped into an existing fireplace opening as an insert.',
      'Many models let you run the flame effect with or without heat, so you can enjoy the look year-round. We’ll help you choose the right size, trim and media — and the right electrical setup for the heater.',
    ],
    fuels: ['electric'],
    retrofit: true,
    card: { src: electricWallModern, alt: 'Wall-mounted linear electric fireplace in a bright modern room' },
    highlights: [
      { title: 'Install almost anywhere', text: 'No chimney, venting or gas line required.' },
      { title: 'Flame with or without heat', text: 'Enjoy the ambiance in July and the warmth in January.' },
      { title: 'Low maintenance', text: 'No ash, no soot, no chimney to sweep.' },
      { title: 'Plug-in or built-in', text: 'From simple plug-in units to hardwired linear showpieces.' },
    ],
    options: [
      'Wall-mount & recessed linear',
      'Cabinet & media mantels',
      'Fireplace inserts',
      'Log, crystal & driftwood media',
      'Remote & app control',
      'Plug-in or hardwired',
    ],
    brands: ['dimplex', 'heatilator'],
    tips: [
      {
        title: 'Best for supplemental heat',
        text: 'Electric heaters are great at taking the chill off a room. If you want to heat a large space, look at wood, gas or pellet options too.',
        link: { label: 'Compare fuels', href: withBase('/fireplace-finder/#compare') },
      },
    ],
    faqs: ['which-fuel', 'visit'],
    related: ['mantels-surrounds', 'fireplace-inserts', 'gas-fireplaces'],
  },
  /* ------------------------------------------------------------------ */
  {
    slug: 'outdoor-fireplaces',
    group: 'fireplaces',
    name: 'Outdoor Fireplaces',
    short: 'Stretch patio season with an outdoor fireplace or fire feature.',
    lead: 'From a stone wood-burning fireplace on the porch to a gas fire feature by the dock, an outdoor fire turns a patio into a living space you’ll use most of the year.',
    overview: [
      'Around the Lake of the Ozarks and across Southwest Missouri, outdoor living isn’t a summer-only thing. A fireplace takes the edge off cool spring evenings, crisp fall nights and mild winter weekends.',
      'We carry outdoor-rated wood and gas fireplaces, lightweight masonry kits and fire features — and we’ll help you plan placement, clearances and finishing materials like cultured stone.',
    ],
    fuels: ['wood', 'gas'],
    outdoor: true,
    card: { src: outdoorStone, alt: 'Outdoor fireplace in a stacked-stone wall on a lawn', position: '50% 50%' },
    hero: { src: panoOutdoor, alt: 'Outdoor gas fireplace built into a long stacked-stone wall', position: '50% 50%' },
    highlights: [
      { title: 'Made for the elements', text: 'Outdoor-rated construction and components designed for exposure.' },
      { title: 'Wood or gas', text: 'The crackle of real logs or the ease of a gas flame.' },
      { title: 'Pairs with stone', text: 'Finish in cultured or natural stone veneer for a timeless look.' },
      { title: 'Extends the season', text: 'Enjoy the porch, patio or dock well past summer.' },
    ],
    options: [
      'Outdoor wood fireplaces',
      'Outdoor gas fireplaces',
      'Linear fire features',
      'Masonry fireplace kits',
      'Fire pits & fire features',
    ],
    brands: ['heat-glo', 'montigo', 'davinci', 'mason-lite', 'empire', 'monessen', 'hpc'],
    tips: [
      {
        title: 'Mind the clearances',
        text: 'Outdoor units still need proper clearances from combustibles — especially under covered porches and pergolas. We’ll help you plan it right.',
      },
    ],
    faqs: ['builders', 'which-fuel'],
    related: ['cultured-stone', 'gas-fireplaces', 'wood-fireplaces'],
  },
  /* ------------------------------------------------------------------ */
  {
    slug: 'vent-free-gas',
    group: 'fireplaces',
    name: 'Vent-Free Gas Fireplaces',
    short: 'Highly efficient gas heat where a chimney or vent isn’t an option.',
    lead: 'Vent-free gas fireplaces, stoves and log sets don’t need a chimney or vent pipe — a practical choice for older homes, large rooms and spots where venting just isn’t possible.',
    overview: [
      'Because no heat escapes up a flue, vent-free appliances are remarkably efficient: virtually all of the heat they produce stays in the room. Customize with blowers, trims, decorative louvers and cast-iron surrounds, or choose a vent-free stove in a variety of fronts and colors.',
      'Vent-free isn’t right for every room. Appliances must be sized for the space, and some local codes limit where they can be used. We’ll walk you through the requirements before you buy.',
    ],
    fuels: ['gas'],
    retrofit: true,
    card: { src: panoGasMinimal, alt: 'Clean-lined gas fireplace in a bright, minimal room', position: '78% 50%' },
    hero: { src: panoGasMinimal, alt: 'Clean-lined gas fireplace in a bright, minimal room', position: '50% 50%' },
    highlights: [
      { title: 'No chimney needed', text: 'Install where venting is impractical or too costly.' },
      { title: 'Exceptional efficiency', text: 'Nearly all of the heat stays in your living space.' },
      { title: 'Fireplaces, stoves & logs', text: 'Choose the format that suits your room.' },
      { title: 'Dependable backup heat', text: 'Many models operate without household electricity.' },
    ],
    options: [
      'Vent-free fireplaces',
      'Vent-free stoves',
      'Vent-free log sets',
      'Blowers',
      'Louvers & trims',
      'Cast-iron surrounds',
    ],
    brands: ['monessen', 'empire'],
    tips: [
      {
        title: 'Size it right',
        text: 'Vent-free appliances are rated for a minimum room size and aren’t permitted in some rooms or jurisdictions. We’ll confirm before you buy.',
      },
    ],
    faqs: ['vent-free', 'power-outage'],
    related: ['gas-logs', 'gas-stoves', 'gas-fireplaces'],
  },
  /* ------------------------------------------------------------------ */
  {
    slug: 'gas-logs',
    group: 'fireplaces',
    name: 'Gas Log Sets',
    short: 'Give an existing fireplace a realistic, effortless fire.',
    lead: 'A quality gas log set turns an underused wood-burning fireplace into a beautiful focal point you can enjoy any night of the week — without the ashes.',
    overview: [
      'The best log sets are molded from real wood and hand-painted for remarkably lifelike bark, char and embers. Pair them with a burner sized for your firebox and a remote or wall switch for easy control.',
      'Log sets come in vented and vent-free versions for natural gas or propane. We’ll measure your fireplace, check your chimney and recommend the set and burner that fit best.',
    ],
    fuels: ['gas'],
    retrofit: true,
    card: { src: gasLogs, alt: 'Close-up of a realistic gas log set with tall flames and glowing embers' },
    highlights: [
      { title: 'Uses your fireplace', text: 'A fast upgrade for most existing wood-burning fireplaces.' },
      { title: 'Lifelike detail', text: 'Premium sets are molded from real wood and hand-painted.' },
      { title: 'Natural gas or propane', text: 'Sets and burners are available for either fuel.' },
      { title: 'Vented or vent-free', text: 'Choose the big open-fire look or maximum efficiency.' },
    ],
    options: [
      'Oak, split-wood & rustic styles',
      'Vented & vent-free burners',
      'Remote & wall-switch control',
      'Glowing embers & lava rock',
    ],
    brands: ['hargrove', 'heat-glo', 'monessen', 'empire'],
    tips: [
      {
        title: 'Add glass doors',
        text: 'Fireplace doors help stop cold drafts when the fireplace isn’t in use. Ask us which doors are compatible with your log set.',
        link: { label: 'Fireplace doors', href: withBase('/products/fireplace-doors/') },
      },
    ],
    faqs: ['vent-free', 'insert-fit'],
    related: ['vent-free-gas', 'fireplace-doors', 'fireplace-inserts'],
  },
  /* ------------------------------------------------------------------ */
  {
    slug: 'fireplace-inserts',
    group: 'inserts-stoves',
    name: 'Fireplace Inserts',
    short: 'Turn a drafty, rarely used fireplace into a dependable heat source.',
    lead: 'If your fireplace sends more heat up the chimney than into the room, an insert can change that. Inserts slide into the existing opening and turn it into an efficient, sealed heater — wood, gas or pellet.',
    overview: [
      'An insert is a self-contained firebox that fits inside your current masonry or factory-built fireplace and vents through a new liner up the existing chimney. Worn or damaged firebox? An insert is often the fix.',
      'We’ll measure your opening, look over the chimney and help you choose the fuel, size and front that suit your home — then install it with a properly sized liner.',
    ],
    fuels: ['wood', 'gas', 'pellet'],
    retrofit: true,
    card: { src: gasInsert, alt: 'Gas fireplace insert with a black surround set into a brick fireplace' },
    hero: { src: panoInsert, alt: 'Fireplace insert glowing inside a blue-gray slate wall with a wood mantel', position: '50% 50%' },
    highlights: [
      { title: 'Fits your fireplace', text: 'No major construction — the insert installs inside the current opening.' },
      { title: 'Stops the drafts', text: 'A sealed firebox keeps warm room air from escaping up the chimney.' },
      { title: 'Real heating power', text: 'Built-in blowers move heat into the room instead of up the flue.' },
      { title: 'Choose your fuel', text: 'Wood, gas or pellet — whatever fits your lifestyle.' },
    ],
    options: [
      'Flush & projecting designs',
      'Surrounds & trim in many finishes',
      'Blowers',
      'Remote & thermostat control',
      'Full chimney liners',
    ],
    subtypes: [
      {
        name: 'Wood inserts',
        text: 'The most heat for the money if you have firewood. Many models can warm a large share of the home.',
        brands: ['quadra-fire', 'lopi', 'harman', 'hearthstone', 'kuma', 'fireplace-x'],
      },
      {
        name: 'Gas inserts',
        text: 'Push-button convenience with a built-in blower and lifelike logs or contemporary media.',
        brands: ['heat-glo', 'heatilator', 'fireplace-x', 'empire', 'monessen', 'kozy-heat', 'montigo'],
      },
      {
        name: 'Pellet inserts',
        text: 'Thermostat-controlled, clean and consistent heat fed from a hopper of wood pellets.',
        brands: ['quadra-fire', 'harman', 'lopi'],
      },
    ],
    brands: ['quadra-fire', 'lopi', 'harman', 'hearthstone', 'kuma', 'fireplace-x', 'heat-glo', 'heatilator', 'empire', 'monessen', 'kozy-heat', 'montigo'],
    tips: [
      {
        title: 'Bring a photo & measurements',
        text: 'A photo of your fireplace plus the opening’s width, height and depth helps us narrow down options before your visit.',
      },
    ],
    faqs: ['insert-fit', 'which-fuel', 'power-outage'],
    related: ['gas-logs', 'wood-stoves', 'pellet-stoves', 'fireplace-doors'],
  },
  /* ------------------------------------------------------------------ */
  {
    slug: 'wood-stoves',
    group: 'inserts-stoves',
    name: 'Wood Stoves',
    short: 'Steel, cast-iron and soapstone stoves sized to heat 800 to 3,500 sq. ft.',
    lead: 'A good wood stove is a lifetime companion: it heats the house, rides out the ice storm and becomes the place everyone gathers. We carry steel, cast-iron and soapstone stoves for cabins, lake houses and whole homes.',
    overview: [
      'Depending on the model, our wood stoves are sized to heat roughly 800 to 3,500 square feet. Popular options include blowers, ash-removal systems, pedestal or leg bases, and decorative door trim in finishes like gold and nickel.',
      'Cast iron brings classic, detailed styling; steel heats up quickly and offers clean modern lines; soapstone soaks up heat and releases it gently long after the fire dies down.',
    ],
    fuels: ['wood'],
    card: { src: stoveWood, alt: 'Black cast-iron wood stove with a large glass door and a roaring fire', cutout: true },
    hero: { src: panoWoodStoves, alt: 'Two modern wood stoves on stone hearths, one beside a stacked log holder', position: '50% 60%' },
    highlights: [
      { title: 'Serious heat', text: 'Models sized for a single room up to an entire home.' },
      { title: 'No power required', text: 'Keeps you warm through outages and winter storms.' },
      { title: 'Three classic materials', text: 'Steel, cast iron and soapstone — each with its own character.' },
      { title: 'Built to last', text: 'A well-maintained stove gives decades of dependable service.' },
    ],
    options: ['Steel, cast iron & soapstone', 'Blowers', 'Ash-removal systems', 'Pedestal or leg bases', 'Gold & nickel trim'],
    brands: ['quadra-fire', 'vermont-castings', 'lopi', 'hearthstone', 'kuma'],
    tips: [
      {
        title: 'Burn dry wood',
        text: 'Seasoned hardwood with less than about 20% moisture burns hotter and cleaner — and keeps your chimney cleaner, too.',
      },
    ],
    faqs: ['which-fuel', 'annual-service', 'power-outage'],
    related: ['gas-stoves', 'fireplace-inserts', 'pellet-stoves', 'accessories-care'],
  },
  /* ------------------------------------------------------------------ */
  {
    slug: 'gas-stoves',
    group: 'inserts-stoves',
    name: 'Gas Stoves',
    short: 'The classic shape of a freestanding stove with clean, adjustable gas heat.',
    lead: 'Gas stoves bring the timeless look of a wood stove to any room — with steady, thermostat-controlled heat and no firewood to haul.',
    overview: [
      'Direct-vent gas stoves can vent through a wall or the roof, which makes them a flexible choice for additions, basements and rooms without a chimney. Choose detailed cast-iron designs or clean modern steel in a range of colors and finishes.',
      'Many models can keep heating during a power outage. Ask about ignition systems and battery backups when you visit either showroom.',
    ],
    fuels: ['gas'],
    card: { src: stoveGas, alt: 'Black cast-iron gas stove with arched doors and a glowing flame', cutout: true },
    highlights: [
      { title: 'Vent through a wall', text: 'No masonry chimney needed.' },
      { title: 'Thermostat control', text: 'Set it and enjoy steady, even heat.' },
      { title: 'Classic or contemporary', text: 'Cast-iron detailing, enamel colors or modern steel.' },
      { title: 'Natural gas or propane', text: 'A great fit for homes on propane.' },
    ],
    options: ['Cast iron & steel', 'Enamel color finishes', 'Blowers', 'Remote & thermostat control', 'Battery-backup ignition'],
    brands: ['vermont-castings', 'lopi', 'hearthstone', 'empire'],
    tips: [
      {
        title: 'Featured this fall',
        text: 'Vermont Castings wood and gas stoves by Forge & Flame are on display at both HMI showrooms.',
        link: { label: 'See the feature', href: withBase('/#featured') },
      },
    ],
    faqs: ['power-outage', 'visit'],
    related: ['wood-stoves', 'vent-free-gas', 'gas-fireplaces'],
  },
  /* ------------------------------------------------------------------ */
  {
    slug: 'pellet-stoves',
    group: 'inserts-stoves',
    name: 'Pellet Stoves & Inserts',
    short: 'Automatic, thermostat-controlled heat from clean-burning wood pellets.',
    lead: 'Pellet stoves and inserts combine the renewable fuel of a wood fire with the convenience of a thermostat. Fill the hopper, set the temperature and enjoy consistent heat for hours.',
    overview: [
      'Pellets are made from compressed sawdust and wood byproducts, so they’re uniform, easy to store by the bag and burn very cleanly. An auger feeds fuel to the fire automatically, and many models hold a steady room temperature on their own.',
      'A pellet insert is also one of the best ways to turn a drafty open fireplace into an efficient heater. Pellet appliances need electricity to run, so ask us about battery-backup options if outages are a concern.',
    ],
    fuels: ['pellet'],
    retrofit: true,
    card: { src: pelletInsert, alt: 'Pellet insert with a cast-iron surround installed in a stone fireplace' },
    highlights: [
      { title: 'Set-and-forget heat', text: 'Automatic fuel feed and thermostat control.' },
      { title: 'Clean, renewable fuel', text: 'Uniform pellets made from wood byproducts.' },
      { title: 'Easy storage', text: 'Bagged fuel stacks neatly in a garage or shed.' },
      { title: 'Stove or insert', text: 'Freestanding, or installed in your existing fireplace.' },
    ],
    options: ['Freestanding stoves', 'Fireplace inserts', 'Thermostat control', 'Large-capacity hoppers', 'Battery-backup options'],
    brands: ['quadra-fire', 'harman', 'lopi'],
    tips: [
      {
        title: 'Run the numbers',
        text: 'See what pellets cost per unit of heat compared with propane, natural gas, firewood and electricity.',
        link: { label: 'Fuel cost calculator', href: withBase('/fireplace-finder/#calculator') },
      },
    ],
    faqs: ['which-fuel', 'power-outage', 'insert-fit'],
    related: ['fireplace-inserts', 'wood-stoves', 'gas-stoves'],
  },
  /* ------------------------------------------------------------------ */
  {
    slug: 'mantels-surrounds',
    group: 'hearth-home',
    name: 'Mantels & Surrounds',
    short: 'The finishing piece — from simple wall mantels to columned cast-stone surrounds.',
    lead: 'The right mantel turns a fireplace into the architecture of the room. We carry four lines of mantels and surrounds, from simple unfinished wall shelves to grand cast-stone designs with columns.',
    overview: [
      'Need a cabinet mantel to frame an electric fireplace? A corner cabinet for a gas unit? A rustic beam or a formal surround for a wood-burning fireplace? We’ll help you match size, style and clearances to your fireplace.',
      'Pair your mantel with cultured stone or new fireplace doors for a complete hearth makeover.',
    ],
    fuels: [],
    card: { src: mantel, alt: 'Dark carved-wood traditional mantel framing an arched fireplace', position: '50% 40%' },
    highlights: [
      { title: 'Four mantel lines', text: 'From budget-friendly to heirloom quality.' },
      { title: 'Cabinet mantels', text: 'Complete packages for electric and gas fireplaces, including corner units.' },
      { title: 'Wood & cast stone', text: 'Unfinished, painted and stained wood or classic cast stone.' },
      { title: 'Clearance-smart', text: 'We make sure your mantel meets the fireplace maker’s clearance requirements.' },
    ],
    options: ['Unfinished wall mantels', 'Cabinet & media mantels', 'Corner mantels', 'Cast-stone surrounds', 'Stone-look lightweight mantels'],
    brands: ['magrahearth'],
    faqs: ['visit', 'builders'],
    related: ['fireplace-doors', 'cultured-stone', 'electric-fireplaces'],
  },
  /* ------------------------------------------------------------------ */
  {
    slug: 'fireplace-doors',
    group: 'hearth-home',
    name: 'Fireplace Doors',
    short: 'Custom glass doors that dress up the hearth and stop the drafts.',
    lead: 'A well-made set of fireplace doors refreshes the look of an older fireplace and helps keep warm room air from escaping up the chimney when the fire is out.',
    overview: [
      'We offer doors from several respected makers in a wide range of frame styles, finishes and glass options — many built to the exact size and shape of your opening, including arched and custom masonry fireplaces.',
      'Bring us a photo and measurements and we’ll help you choose a style that suits your room.',
    ],
    fuels: [],
    retrofit: true,
    card: { src: doors, alt: 'Arched black fireplace doors in a white paneled mantel', position: '50% 50%' },
    highlights: [
      { title: 'Stops cold drafts', text: 'Close the doors whenever the fireplace isn’t in use.' },
      { title: 'Custom fit', text: 'Doors made to the size and shape of your opening.' },
      { title: 'Many finishes', text: 'Hand-forged iron, black, bronze, nickel and more.' },
      { title: 'Safer fires', text: 'Mesh and glass help contain sparks and embers.' },
    ],
    options: ['Masonry & factory-built fireplaces', 'Arched & custom shapes', 'Mesh & glass options', 'Many frame finishes'],
    brands: ['iron-haus', 'stoll', 'design-specialties', 'thermo-rite'],
    faqs: ['insert-fit', 'visit'],
    related: ['mantels-surrounds', 'gas-logs', 'accessories-care'],
  },
  /* ------------------------------------------------------------------ */
  {
    slug: 'cultured-stone',
    group: 'hearth-home',
    name: 'Cultured Stone & Veneer',
    short: 'Manufactured and natural stone veneer for fireplaces, walls and exteriors.',
    lead: 'Stone has been part of HMI since our first store sold fireplaces and stucco stone veneer in 1975. Today we carry manufactured and natural stone veneer for fireplace surrounds, accent walls and home exteriors.',
    overview: [
      'Manufactured stone veneer captures the texture and color of natural stone at a fraction of the weight, so it can be applied over a wide range of surfaces without extra structural support. Natural thin-stone panels offer the real thing in easy-to-install formats.',
      'Stop in to see stone samples, and bring your paint and flooring swatches — we’ll help you find a color and profile that ties the room together.',
    ],
    fuels: [],
    outdoor: true,
    card: { src: stoneSamples, alt: 'Row of stone veneer samples in gray, tan and brown ledgestone profiles', position: '30% 50%' },
    hero: { src: panoStoneHome, alt: 'Two-story home with stone veneer accents and a landscaped front yard', position: '50% 45%' },
    highlights: [
      { title: 'Lightweight', text: 'Adhered veneer skips the footings full-depth stone needs.' },
      { title: 'Indoors & out', text: 'Fireplace surrounds, accent walls, exteriors and outdoor kitchens.' },
      { title: 'Many profiles & colors', text: 'Ledgestone, fieldstone, river rock and more.' },
      { title: 'Part of our story', text: 'Stone veneer has been an HMI specialty since 1975.' },
    ],
    options: ['Manufactured stone veneer', 'Natural thin-stone panels', 'Ledgestone & stacked stone', 'Fieldstone & river rock', 'Hearthstones & trim'],
    brands: ['cultured-stone', 'realstone'],
    faqs: ['builders', 'visit'],
    related: ['outdoor-fireplaces', 'mantels-surrounds', 'wood-fireplaces'],
  },
  /* ------------------------------------------------------------------ */
  {
    slug: 'accessories-care',
    group: 'hearth-home',
    name: 'Accessories & Care',
    short: 'Screens, tool sets, log holders and the cleaners that keep it all looking new.',
    lead: 'The little things make a fireplace a pleasure to use. Stop in for screens, tool sets and log holders — plus the glass cleaners, stone cleaners, gasket cement and repair products that keep your hearth in top shape.',
    overview: [
      'Our showrooms stock practical, good-looking accessories from trusted makers, including hand-forged ironwork. Not sure what your stove or fireplace needs? Bring in the model number and we’ll point you to the right product.',
    ],
    fuels: [],
    card: { src: accessories, alt: 'Wrought-iron fireplace tool set and log holder on a polished hearth', position: '50% 50%' },
    highlights: [
      { title: 'Screens & tool sets', text: 'Classic and modern designs in many finishes.' },
      { title: 'Log holders', text: 'Keep firewood tidy and close at hand.' },
      { title: 'Cleaners & chemicals', text: 'Glass, stone and creosote care products.' },
      { title: 'Repair supplies', text: 'Gaskets, cement and touch-up products for stoves and fireplaces.' },
    ],
    options: ['Fireplace screens', 'Tool sets', 'Log holders', 'Glass & stone cleaners', 'Gasket & cement', 'Fire starters'],
    brands: ['imperial', 'hy-c', 'uniflame', 'stone-county', 'blue-rhino'],
    faqs: ['annual-service', 'visit'],
    related: ['fireplace-doors', 'wood-stoves', 'mantels-surrounds'],
  },
];

export const getCategory = (slug: string) => {
  const c = categories.find((x) => x.slug === slug);
  if (!c) throw new Error(`Unknown category: ${slug}`);
  return c;
};

export const categoriesInGroup = (group: GroupId) => categories.filter((c) => c.group === group);

export const categoryHref = (slug: string) => withBase(`/products/${slug}/`);

export const fuelLabels: Record<Fuel, string> = {
  wood: 'Wood',
  gas: 'Gas',
  electric: 'Electric',
  pellet: 'Pellet',
};
