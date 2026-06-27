import React, { useMemo } from "react";
import { Text, View } from "react-native";
import { SvgXml } from "react-native-svg";
import { MemberAvatar as MemberAvatarConfig } from "@/types";
import { avatarSvg } from "@/services/avatar";
import { COLORS } from "@/utils/theme";

// Renders a family member's avatar: an illustrated SVG when there's a config,
// the legacy emoji as a fallback for older members, else a neutral circle.
// Memoised by the config's values so it doesn't regenerate the SVG every render.
export function MemberAvatar({
  avatar,
  emoji,
  size,
}: {
  avatar?: MemberAvatarConfig | null;
  emoji?: string | null;
  size: number;
}) {
  const svg = useMemo(
    () => (avatar ? avatarSvg(avatar, size) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [avatar?.style, avatar?.seed, avatar?.skinColor, avatar?.hairColor, avatar?.hair, size]
  );

  if (svg) {
    return <SvgXml xml={svg} width={size} height={size} />;
  }
  if (emoji) {
    return <Text style={{ fontSize: size * 0.72 }}>{emoji}</Text>;
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: COLORS.accentLight,
      }}
    />
  );
}
