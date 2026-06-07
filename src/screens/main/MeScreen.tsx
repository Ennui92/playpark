import React from "react";
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Button } from "@/components/Button";
import { useSession } from "@/contexts/SessionContext";
import { RootStackParamList } from "@/types";
import { COLORS, FONT_SIZE, RADIUS, SHADOW, SPACING } from "@/utils/theme";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function MeScreen() {
  const { family, user, signOut } = useSession();
  const nav = useNavigation<Nav>();

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.title}>{family?.name ?? "Your account"}</Text>
        <Text style={styles.sub}>
          {user?.display_name} · @{user?.username}
        </Text>

        <View style={styles.card}>
          <TouchableOpacity
            style={styles.rowTap}
            onPress={() => nav.navigate("EditNeighborhood")}
          >
            <Text style={styles.rowLabel}>Neighborhood</Text>
            <Text style={styles.rowValueLink}>{family?.zip ?? "—"} ›</Text>
          </TouchableOpacity>
          <Row label="Username" value={`@${user?.username ?? "—"}`} />
        </View>

        <Button
          title="Sign out"
          variant="secondary"
          onPress={() =>
            Alert.alert("Sign out?", "", [
              { text: "Cancel", style: "cancel" },
              { text: "Sign out", style: "destructive", onPress: signOut },
            ])
          }
          style={{ marginTop: SPACING.xl }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  body: { padding: SPACING.xl },
  title: { fontSize: FONT_SIZE.xxl, fontWeight: "800", color: COLORS.textPrimary },
  sub: { color: COLORS.textSecondary, marginTop: SPACING.xs },
  card: {
    marginTop: SPACING.lg,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    ...SHADOW.sm,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: SPACING.sm,
  },
  rowTap: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: SPACING.sm,
  },
  rowLabel: { color: COLORS.textSecondary },
  rowValue: { color: COLORS.textPrimary, fontWeight: "600" },
  rowValueLink: { color: COLORS.accent, fontWeight: "700" },
});
