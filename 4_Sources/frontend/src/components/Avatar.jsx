import { useEffect, useState } from 'react';

function Avatar({
  src,
  initials = '??',
  title = 'Аватар',
  className = '',
  clickable = true,
}) {
  const [open, setOpen] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const hasImage = Boolean(src) && !imageFailed;
  const normalizedInitials = (initials || '??').slice(0, 2).toUpperCase();
  const classes = `avatar ${hasImage ? 'avatar--image' : 'avatar--primary'} ${className}`.trim();

  useEffect(() => {
    setImageFailed(false);
    setOpen(false);
  }, [src]);

  const content = hasImage ? (
    <img src={src} alt={title} loading="lazy" onError={() => setImageFailed(true)} />
  ) : normalizedInitials;

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
