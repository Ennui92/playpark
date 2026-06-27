import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { getMyOutingHistory } from "@/services/broadcasts";
import { useSession } from "@/contexts/SessionContext";
import { useT } from "@/i18n";
import { BroadcastFeedItem, RootStackParamList } from "@/types";
import { COLORS, FONT_SIZE, RADIUS, SHADOW, SPACING } from "@/utils/theme";
import { formatDate } from "@/utils/format";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function HistoryScreen() {
  const nav = useNavigation<Nav>();
  const { family } = useSession();
  const t = useT();

  const [items, setItems] = useState<BroadcastFeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!family) return;
    try {
      setItems(await getMyOutingHistory(family.id));
    } finally {
      setLoading(false);
    }
  }, [family]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => nav.goBack()}>
          <Text style={styles.back}>{t("common.back")}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.accent} style={{ marginTop: SPACING.xxl }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(b) => b.id}
          contentContainerStyle={styles.body}
          ListHeaderComponent={
            <View style={styles.header}>
              <Text style={styles.title}>{t("hist.title")}</Text>
              <Text style={styles.sub}>{t("hist.sub")}</Text>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🗺️</Text>
              <Text style={styles.emptyText}>{t("hist.empty")}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              activeOpacity={0.85}
              onPress={() => nav.navigate("Landmark", { landmarkId: item.landmark_id })}
            >
              <Text style={styles.rowEmoji}>{item.landmark_emoji ?? "📍"}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowName} numberOfLines={1}>
                  {item.landmark_name}
                </Text>
                <Text style={styles.rowDate}>{formatDate(new Date(item.planned_at))}</Text>
                {!!item.message && (
                  <Text style={styles.rowMsg} numberOfLines={1}>
                    “{item.message}”
                  </Text>
                )}
              </View>
              <Text style={styles.rowChevron}>›</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  topBar: { padding: SPACING.md },
  back: { color: COLORS.accent, fontSize: FONT_SIZE.md, fontWeight: "600" },
  body: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxl },
  header: { marginBottom: SPACING.lg },
  title: { fontSize: FONT_SIZE.xxl, fontWeight: "800", color: COLORS.textPrimary },
  sub: { color: COLORS.textSecondary, marginTop: SPACING.xs },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    ...SHADOW.sm,
  },
  rowEmoji: { fontSize: 30 },
  rowName: { fontSize: FONT_SIZE.md, fontWeight: "700", color: COLORS.textPrimary },
  rowDate: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 1 },
  rowMsg: { fontSize: FONT_SIZE.sm, color: COLORS.textTertiary, marginTop: 1, fontStyle: "italic" },
  rowChevron: { fontSize: 26, color: COLORS.textTertiary, fontWeight: "300" },
  empty: { alignItems: "center", marginTop: SPACING.xxl, paddingHorizontal: SPACING.xl },
  emptyEmoji: { fontSize: 48, marginBottom: SPACING.md },
  emptyText: { color: COLORS.textSecondary, textAlign: "center", fontSize: FONT_SIZE.md, lineHeight: 22 },
});
