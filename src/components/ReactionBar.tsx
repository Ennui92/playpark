import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { BroadcastReaction } from "@/types";
import { REACTION_EMOJIS } from "@/services/broadcasts";
import { COLORS, FONT_SIZE, RADIUS, SPACING } from "@/utils/theme";

// Shows the reactions on a broadcast (grouped emoji + count) plus a single,
// quiet trigger to add/change your own. The full emoji row only appears when
// you tap or long-press the trigger, so the card stays calm. One reaction per
// family; tapping your current emoji clears it.
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
  const [pickerOpen, setPickerOpen] = useState(false);

  const summary = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of reactions) counts.set(r.emoji, (counts.get(r.emoji) ?? 0) + 1);
    return [...counts.entries()];
  }, [reactions]);

  const mine = reactions.find((r) => r.family_id === myFamilyId)?.emoji ?? null;

  if (summary.length === 0 && !canReact) return null;

  function pick(emoji: string) {
    onReact(emoji); // toggles off if it's already mine
    setPickerOpen(false);
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.topRow}>
        {canReact && (
          <TouchableOpacity
            style={[styles.trigger, mine ? styles.triggerActive : null]}
            onPress={() => setPickerOpen((o) => !o)}
            onLongPress={() => setPickerOpen(true)}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Text style={styles.triggerEmoji}>{mine ?? "🙂"}</Text>
            {!mine && <Text style={styles.triggerPlus}>＋</Text>}
          </TouchableOpacity>
        )}
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
      </View>

      {canReact && pickerOpen && (
        <View style={styles.picker}>
          {REACTION_EMOJIS.map((emoji) => {
            const active = mine === emoji;
            return (
              <TouchableOpacity
                key={emoji}
                style={[styles.pickBtn, active && styles.pickBtnActive]}
                onPress={() => pick(emoji)}
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
  wrap: { marginTop: SPACING.sm },
  topRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: SPACING.sm },
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
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: SPACING.sm,
    height: 32,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  triggerActive: { backgroundColor: COLORS.accentLight, borderColor: COLORS.accent },
  triggerEmoji: { fontSize: 18 },
  triggerPlus: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, fontWeight: "800" },
  picker: {
    flexDirection: "row",
    gap: SPACING.xs,
    marginTop: SPACING.sm,
    alignSelf: "flex-start",
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.xs,
  },
  pickBtn: {
    width: 40,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADIUS.full,
  },
  pickBtnActive: { backgroundColor: COLORS.accentLight },
  pickEmoji: { fontSize: 20 },
});
