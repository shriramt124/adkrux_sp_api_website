import React from 'react';

const LOGO_SRC = '/zoho%20logo%20Curved.png';

export default function Logo({
  className = 'h-8 w-auto',
  alt = 'Logo',
  ...props
}) {
  return (
    <img
      src={LOGO_SRC}
      alt={alt}
      className={className}
      decoding="async"
      loading="eager"
      {...props}
    />
  );
}
