import { useState } from 'react';

function Avatar({
  src,
  initials = '??',
  title = 'Аватар',
  className = '',
  clickable = true,
}) {
  const [open, setOpen] = useState(false);
  const hasImage = Boolean(src);
  const normalizedInitials = (initials || '??').slice(0, 2).toUpperCase();
  const classes = `avatar ${hasImage ? 'avatar--image' : 'avatar--primary'} ${className}`.trim();

  const content = hasImage ? <img src={src} alt={title} loading="lazy" /> : normalizedInitials;

  if (!hasImage || !clickable) {
    return (
      <span className={classes} title={title}>
        {content}
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        className={`${classes} avatar--button`}
        onClick={() => setOpen(true)}
        title="Открыть фото"
        aria-label={`Открыть фото: ${title}`}
      >
        {content}
      </button>
      {open && (
        <button
          type="button"
          className="avatar-lightbox"
          onClick={() => setOpen(false)}
          aria-label="Закрыть фото"
        >
          <img src={src} alt={title} />
        </button>
      )}
    </>
  );
}

export default Avatar;
