import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Share,
  Platform,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Button } from "@/components/Button";
import {
  addFriendViaUsername,
  getFriendFamilies,
  removeFriendship,
} from "@/services/friends";
import { useSession } from "@/contexts/SessionContext";
import { Family, RootStackParamList } from "@/types";
import { COLORS, FONT_SIZE, RADIUS, SHADOW, SPACING } from "@/utils/theme";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function FriendsScreen() {
  const nav = useNavigation<Nav>();
  const { family, user } = useSession();
  const [friends, setFriends] = useState<Family[]>([]);
  const [username, setUsername] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    if (!family) return;
    const fs = await getFriendFamilies(family.id);
    setFriends(fs);
    setRefreshing(false);
  }, [family]);

  useEffect(() => {
    load();
  }, [load]);

  async function addByUsername() {
    const u = username.trim().toLowerCase();
    if (!u) return;
    setAdding(true);
    try {
      await addFriendViaUsername(u);
      setUsername("");
      await load();
    } catch (e: any) {
      Alert.alert("Couldn't add", e.message ?? "Try again.");
    } finally {
      setAdding(false);
    }
  }

  async function copyUsername() {
    if (!user) return;
    await Clipboard.setStringAsync(`@${user.username}`);
    Alert.alert("Copied", `@${user.username} is on your clipboard.`);
  }

  async function shareUsername() {
    if (!user) return;
    const msg =
      `Add my family on Outside — search @${user.username} (or scan my QR in the app).` +
      `\n\nOutside is the simple way to see where friend families are headed in Berlin.`;
    try {
      await Share.share(
        Platform.OS === "ios"
          ? { message: msg }
          : { message: msg, title: "Add me on Outside" }
      );
    } catch {
      // user cancelled — silent
    }
  }

  function confirmRemove(f: Family) {
    Alert.alert(`Remove ${f.name}?`, "They'll stop seeing your broadcasts.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          await removeFriendship(f.id);
          setFriends((prev) => prev.filter((x) => x.id !== f.id));
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <FlatList
        data={friends}
        keyExtractor={(f) => f.id}
        contentContainerStyle={{ paddingBottom: SPACING.xxl }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={COLORS.accent}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>Friend families</Text>

            {!!user && (
              <View style={styles.youCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.youLabel}>Your handle</Text>
                  <Text style={styles.youHandle}>@{user.username}</Text>
                </View>
                <TouchableOpacity style={styles.iconBtn} onPress={copyUsername}>
                  <Text style={styles.iconBtnText}>Copy</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconBtnPrimary} onPress={shareUsername}>
                  <Text style={styles.iconBtnPrimaryText}>Share</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.qrRow}>
              <Button
                title="Show my QR"
                variant="primary"
                onPress={() => nav.navigate("QRShare")}
                style={{ flex: 1 }}
              />
              <Button
                title="Scan QR"
                variant="secondary"
                onPress={() => nav.navigate("QRScan")}
                style={{ flex: 1 }}
              />
            </View>

            <Text style={styles.or}>or add by username</Text>
            <View style={styles.addRow}>
              <TextInput
                style={styles.input}
                placeholder="chen_family"
                placeholderTextColor={COLORS.textTertiary}
                value={username}
                onChangeText={(t) => setUsername(t.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                autoCapitalize="none"
              />
              <Button
                title="Add"
                onPress={addByUsername}
                loading={adding}
                disabled={username.length < 3}
              />
            </View>

            <Text style={[styles.sectionLabel, { marginTop: SPACING.xl }]}>
              {friends.length} friend {friends.length === 1 ? "family" : "families"}
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>👯</Text>
            <Text style={styles.emptyTitle}>No friend families yet</Text>
            <Text style={styles.emptySub}>
              Scan a QR at the playground, or add by username.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.friendCard}
            onLongPress={() => confirmRemove(item)}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.friendName}>{item.name}</Text>
              <Text style={styles.friendZip}>{item.zip}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { padding: SPACING.xl },
  title: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: "800",
    color: COLORS.textPrimary,
    marginBottom: SPACING.lg,
  },
  youCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOW.sm,
  },
  youLabel: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontWeight: "700",
  },
  youHandle: { color: COLORS.accent, fontWeight: "800", fontSize: FONT_SIZE.lg, marginTop: 2 },
  iconBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  iconBtnText: { color: COLORS.textPrimary, fontWeight: "700" },
  iconBtnPrimary: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.accent,
  },
  iconBtnPrimaryText: { color: "#fff", fontWeight: "700" },
  qrRow: { flexDirection: "row", gap: SPACING.sm },
  or: {
    color: COLORS.textTertiary,
    textAlign: "center",
    marginVertical: SPACING.md,
    textTransform: "uppercase",
    fontSize: FONT_SIZE.xs,
    fontWeight: "700",
    letterSpacing: 1,
  },
  addRow: { flexDirection: "row", gap: SPACING.sm, alignItems: "center" },
  input: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    fontSize: FONT_SIZE.md,
    color: COLORS.textPrimary,
  },
  sectionLabel: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  friendCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    ...SHADOW.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.accentLight,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontWeight: "800", color: COLORS.accent, fontSize: FONT_SIZE.lg },
  friendName: { fontSize: FONT_SIZE.md, fontWeight: "700", color: COLORS.textPrimary },
  friendZip: { color: COLORS.textSecondary, marginTop: 2 },
  empty: { alignItems: "center", paddingHorizontal: SPACING.xl, paddingTop: SPACING.xl },
  emptyEmoji: { fontSize: 56, marginBottom: SPACING.md },
  emptyTitle: { fontSize: FONT_SIZE.lg, fontWeight: "700", color: COLORS.textPrimary },
  emptySub: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginTop: SPACING.xs,
  },
});
