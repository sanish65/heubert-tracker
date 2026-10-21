"use client";

import { useState } from "react";
import { useApp } from "@/context/AppContext";
import { initials, avatarColor, photoForName, photoUrlOf } from "@/lib/avatar";

// Every person avatar in the app. Once someone has signed in, it is their Google profile
// photo (AppContext's employeePhotos, by name; yours straight from your session).
// Otherwise, or when the photo fails to load, it is the initials disc each screen drew
// before: the call site's class, initials(name) over avatarColor(name), or the orange disc
// for you. The class keeps every size as it was. The photo is decorative (alt=""), as the
// name always sits beside it; extra props (aria-hidden, title, aria-label) pass through.
export default function Avatar({ name, className = "avatar", isMe = false, ...rest }) {
  const { employeePhotos, user } = useApp();
  // The photo that failed to load, so it falls back to initials; a new URL is tried afresh.
  const [failedSrc, setFailedSrc] = useState(null);
  const photo = (isMe && photoUrlOf(user)) || photoForName(employeePhotos, name);
  const classes = isMe ? `${className} avatar-me` : className;

  if (photo && photo !== failedSrc) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- a remote Google photo: next/image needs images.remotePatterns in next.config for it
      <img
        src={photo}
        alt=""
        className={`${classes} avatar-photo`}
        referrerPolicy="no-referrer"
        loading="lazy"
        decoding="async"
        onError={() => setFailedSrc(photo)}
        {...rest}
      />
    );
  }

  return (
    <span className={classes} style={isMe ? undefined : { background: avatarColor(name) }} {...rest}>
      {initials(name)}
    </span>
  );
}
