import React, { useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { BroadcastReaction } from "@/types";
import { REACTION_EMOJIS } from "@/services/broadcasts";
import { COLORS, FONT_SIZE, RADIUS, SPACING } from "@/utils/theme";

// Shows the reactions left on a broadcast (grouped emoji + count) and, when
// allowed, a quick-tap row to add/change/remove your own. One reaction per
// family; tapping your current emoji again clears it.
export function ReactionBar({
  reactions,
  myFamilyId,
  canReact,
  onReact,
}: {
  reactions: BroadcastReaction[];
  myFamilyId: string;
  canReact: boolean;
  onReact: (emoji: string) => void;
}) {
  const summary = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of reactions) counts.set(r.emoji, (counts.get(r.emoji) ?? 0) + 1);
    return [...counts.entries()];
  }, [reactions]);

  const mine = reactions.find((r) => r.family_id === myFamilyId)?.emoji ?? null;

  if (summary.length === 0 && !canReact) return null;

  return (
    <View style={styles.wrap}>
      {summary.length > 0 && (
        <View style={styles.summary}>
          {summary.map(([emoji, count]) => (
            <View key={emoji} style={styles.pill}>
              <Text style={styles.pillEmoji}>{emoji}</Text>
              {count > 1 && <Text style={styles.pillCount}>{count}</Text>}
            </View>
          ))}
        </View>
      )}
      {canReact && (
        <View style={styles.picker}>
          {REACTION_EMOJIS.map((emoji) => {
            const active = mine === emoji;
            return (
              <TouchableOpacity
                key={emoji}
                style={[styles.pickBtn, active && styles.pickBtnActive]}
                onPress={() => onReact(emoji)}
                hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
              >
                <Text style={styles.pickEmoji}>{emoji}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: SPACING.sm, gap: SPACING.xs },
  summary: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.xs },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
  },
  pillEmoji: { fontSize: FONT_SIZE.sm },
  pillCount: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, fontWeight: "700" },
  picker: { flexDirection: "row", gap: SPACING.xs, marginTop: 2 },
  pickBtn: {
    width: 38,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  pickBtnActive: { backgroundColor: COLORS.accentLight, borderColor: COLORS.accent },
  pickEmoji: { fontSize: 18 },
});
