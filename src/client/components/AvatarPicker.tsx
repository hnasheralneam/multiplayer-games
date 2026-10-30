import { AVATARS, type Avatar } from '../../shared/types';

const LABELS: Record<string, string> = {
  '🦦': 'otter',
  '🐈': 'cat',
  '🦊': 'fox',
  '🐸': 'frog',
  '🐙': 'octopus',
  '🦄': 'unicorn',
  '🐝': 'bee',
  '🦖': 'dinosaur'
};

export function AvatarPicker({
  value,
  onChange,
  disabled = false
}: {
  value: Avatar;
  onChange: (avatar: Avatar) => void;
  disabled?: boolean;
}) {
  return (
    <div className="avatar-picker" role="group" aria-label="Choose an avatar">
      {AVATARS.map((avatar) => (
        <button
          key={avatar}
          type="button"
          className={`avatar-choice ${avatar === value ? 'avatar-choice-on' : ''}`}
          onClick={() => onChange(avatar)}
          aria-label={`Use the ${LABELS[avatar] ?? 'animal'} avatar`}
          aria-pressed={avatar === value}
          disabled={disabled}
        >
          {avatar}
        </button>
      ))}
    </div>
  );
}
