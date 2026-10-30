const ADJECTIVES = [
  'Clever',
  'Salty',
  'Lucky',
  'Sleepy',
  'Turbo',
  'Sneaky',
  'Brave',
  'Grumpy',
  'Breezy',
  'Nimble',
  'Sunny',
  'Quiet'
];

const NOUNS = ['Otter', 'Mole', 'Cat', 'Moth', 'Goose', 'Toad', 'Fox', 'Bean', 'Pigeon', 'Badger'];

export function randomName(): string {
  const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${adjective} ${noun}`;
}
