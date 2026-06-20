import type { Target } from '../types';

// Each target is a self-contained .html file imported as a raw string.
// To ADD a target: drop an .html file in this folder, import it here, and add
// an entry below. See README "Adding your own targets" for the full convention.
import splitHorizon from './01-split-horizon.html?raw';
import bullseye from './02-bullseye.html?raw';
import tricolore from './03-tricolore.html?raw';
import nested from './04-nested.html?raw';
import profileCard from './05-profile-card.html?raw';

export const targets: Target[] = [
  {
    id: 'split-horizon',
    name: 'Split Horizon',
    difficulty: 'easy',
    kind: 'shapes',
    diffThreshold: 0.1,
    html: splitHorizon,
    palette: [
      { name: 'Indigo', hex: '#3a36c4' },
      { name: 'Amber', hex: '#ffb020' },
    ],
  },
  {
    id: 'bullseye',
    name: 'Bullseye',
    difficulty: 'easy',
    kind: 'shapes',
    diffThreshold: 0.1,
    html: bullseye,
    palette: [
      { name: 'Void', hex: '#0d0b1f' },
      { name: 'Teal', hex: '#2dd4bf' },
    ],
  },
  {
    id: 'tricolore',
    name: 'Tricolore',
    difficulty: 'medium',
    kind: 'shapes',
    diffThreshold: 0.1,
    html: tricolore,
    palette: [
      { name: 'Magenta', hex: '#ff2bd6' },
      { name: 'Surface', hex: '#16142e' },
      { name: 'Amber', hex: '#ffb020' },
    ],
  },
  {
    id: 'nested',
    name: 'Nested',
    difficulty: 'medium',
    kind: 'shapes',
    diffThreshold: 0.1,
    html: nested,
    palette: [
      { name: 'Void', hex: '#0d0b1f' },
      { name: 'Indigo', hex: '#3a36c4' },
      { name: 'Teal', hex: '#2dd4bf' },
      { name: 'Amber', hex: '#ffb020' },
    ],
  },
  {
    id: 'profile-card',
    name: 'Profile Card',
    difficulty: 'hard',
    kind: 'shapes',
    diffThreshold: 0.12, // slightly looser: rounded corners create more AA edges
    html: profileCard,
    palette: [
      { name: 'Void', hex: '#0d0b1f' },
      { name: 'Surface', hex: '#16142e' },
      { name: 'Border', hex: '#2c2950' },
      { name: 'Indigo', hex: '#3a36c4' },
      { name: 'Amber', hex: '#ffb020' },
    ],
  },
];
