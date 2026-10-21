import { useState } from "react";
import { View, Text, Image, StyleSheet } from "react-native";
// AppContext first, and every avatar through this component: AppContext loads lib/supabase.js, which
// installs react-native-url-polyfill, and lib/avatar's isGooglePhotoUrl needs that standards URL
// (React Native's own reads "https://evil.example/@lh3.googleusercontent.com/" as Google's host).
import { useApp } from "../context/AppContext";
import { useThemeColors, fonts } from "../lib/theme";
import { initials, avatarColor, isGooglePhotoUrl, photoForName } from "../lib/avatar";

// Hidden from TalkBack and VoiceOver: the name always sits beside an avatar, or the control around
// it carries the label (the top bar's "Account").
const DECORATIVE = { accessible: false, importantForAccessibility: "no-hide-descendants", accessibilityElementsHidden: true };

// The initials' size, from the artboards: list avatars (22-40px) carry 11-13px, the header and
// profile ones about 0.38 of the disc (44 → 17, as the top bar's account button).
function initialsSize(size) {
  return size <= 40 ? Math.max(11, Math.round(size / 3)) : Math.round(size * 0.38);
}

// A person's avatar, as the web's src/components/Avatar.js: their Google profile photo once they
// have signed in (employeePhotos from GET /api/avatars, by name; yours from your own session), else
// the initials disc in their colour. A photo that fails to load falls back to the initials. You are
// orange either way: an orange disc, or a 2px orange ring round your photo.
export default function Avatar({ name, size = 36, isMe = false }) {
  const t = useThemeColors();
  const { employeePhotos, user } = useApp();
  // The photo that failed to load, so it shows initials; a new URL is tried afresh.
  const [failedSrc, setFailedSrc] = useState(null);
  const ownPhoto = isMe ? user?.user_metadata?.avatar_url : null;
  const photo = (isGooglePhotoUrl(ownPhoto) ? ownPhoto : null) || photoForName(employeePhotos, name);
  const disc = { width: size, height: size, borderRadius: size / 2 };

  return (
    <View style={disc} {...DECORATIVE}>
      {photo && photo !== failedSrc ? (
        <Image
          source={{ uri: photo }}
          alt=""
          resizeMode="cover"
          onError={() => setFailedSrc(photo)}
          // The faint fill shows while the photo loads.
          style={[disc, { backgroundColor: t.raised }, isMe && { borderWidth: 2, borderColor: t.orange }]}
        />
      ) : (
        <View style={[disc, styles.center, { backgroundColor: isMe ? t.orange : avatarColor(name) }]}>
          <Text style={[styles.initials, { fontSize: initialsSize(size), color: isMe ? "#0A0E17" : "#FFFFFF" }]}>
            {initials(name)}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  initials: { fontFamily: fonts.displaySemibold, textAlign: "center", includeFontPadding: false },
});
