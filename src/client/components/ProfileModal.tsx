import { useEffect, useState, type FormEvent } from 'react';
import type { Avatar } from '../../shared/types';
import type { Profile } from '../lib/storage';
import { Modal } from './ui';
import { AvatarPicker } from './AvatarPicker';

export function ProfileModal({
  open,
  onClose,
  profile,
  onSave
}: {
  open: boolean;
  onClose: () => void;
  profile: Profile;
  onSave: (profile: Profile) => void;
}) {
  const [name, setName] = useState(profile.name);
  const [avatar, setAvatar] = useState<Avatar>(profile.avatar);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(profile.name);
    setAvatar(profile.avatar);
    setError(null);
  }, [open, profile]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const clean = name.trim();
    if (!clean) {
      setError('Pick a name first.');
      return;
    }
    onSave({ name: clean.slice(0, 16), avatar });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Your name">
      <form className="profile-form" onSubmit={submit}>
        <label className="field-label" htmlFor="profile-name">
          Name
        </label>
        <input
          id="profile-name"
          className="text-input"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setError(null);
          }}
          maxLength={16}
          autoComplete="nickname"
          spellCheck={false}
        />
        <span className="field-label">Avatar</span>
        <AvatarPicker value={avatar} onChange={setAvatar} />
        {error && (
          <div className="inline-error" role="alert">
            {error}
          </div>
        )}
        <div className="settings-actions">
          <button type="button" className="button button-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="button button-primary">
            Save
          </button>
        </div>
      </form>
    </Modal>
  );
}
