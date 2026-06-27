import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Button } from "@/components/Button";
import { showDialog } from "@/components/dialog";
import { useSession } from "@/contexts/SessionContext";
import {
  getFamilyMembers,
  addFamilyMember,
  updateFamilyMember,
  removeFamilyMember,
  MEMBER_EMOJIS,
} from "@/services/members";
import { Member, MemberRole } from "@/types";
import { useT } from "@/i18n";
import { COLORS, FONT_SIZE, RADIUS, SHADOW, SPACING } from "@/utils/theme";

export function FamilyMembersScreen() {
  const nav = useNavigation();
  const { family } = useSession();
  const t = useT();
  const thisYear = new Date().getFullYear();

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Editor state. Closed by default; editId set = editing an existing member.
  const [editorOpen, setEditorOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [role, setRole] = useState<MemberRole>("child");
  const [emoji, setEmoji] = useState<string>(MEMBER_EMOJIS[8]);
  const [age, setAge] = useState("");

  const load = useCallback(async () => {
    if (!family) return;
    try {
      setMembers(await getFamilyMembers(family.id));
    } finally {
      setLoading(false);
    }
  }, [family]);

  useEffect(() => {
    load();
  }, [load]);

  function openAdd() {
    setEditId(null);
    setName("");
    setRole("child");
    setEmoji(MEMBER_EMOJIS[8]);
    setAge("");
    setEditorOpen(true);
  }

  function openEdit(m: Member) {
    setEditId(m.id);
    setName(m.name);
    setRole(m.role);
    setEmoji(m.emoji);
    setAge(m.birth_year ? String(Math.max(0, thisYear - m.birth_year)) : "");
    setEditorOpen(true);
  }

  async function saveMember() {
    if (!family || name.trim().length < 1) return;
    setSaving(true);
    const ageNum = parseInt(age, 10);
    const birthYear =
      role === "child" && Number.isFinite(ageNum) && ageNum >= 0 ? thisYear - ageNum : null;
    try {
      if (editId) {
        await updateFamilyMember(family.id, editId, {
          name: name.trim(),
          role,
          emoji,
          birth_year: birthYear,
        });
      } else {
        await addFamilyMember(family.id, { name: name.trim(), role, emoji, birthYear });
      }
      setEditorOpen(false);
      await load();
    } catch (e: any) {
      showDialog(t("fam.couldntSave"), e?.message ?? t("common.tryAgain"));
    } finally {
      setSaving(false);
    }
  }

  async function onRemove() {
    if (!family || !editId) return;
    setSaving(true);
    try {
      await removeFamilyMember(family.id, editId);
      setEditorOpen(false);
      await load();
    } catch (e: any) {
      showDialog(t("fam.couldntSave"), e?.message ?? t("common.tryAgain"));
    } finally {
      setSaving(false);
    }
  }

  function memberSubtitle(m: Member): string {
    if (m.role === "child" && m.birth_year) {
      return t("fam.ageYears", { age: Math.max(0, thisYear - m.birth_year) });
    }
    return t("fam.grownUp");
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => nav.goBack()}>
            <Text style={styles.back}>{t("common.back")}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>{t("fam.title")}</Text>
          <Text style={styles.sub}>{t("fam.sub")}</Text>

          {loading ? (
            <ActivityIndicator color={COLORS.accent} style={{ marginTop: SPACING.xl }} />
          ) : (
            <>
              {members.length === 0 && !editorOpen && (
                <Text style={styles.empty}>{t("fam.empty")}</Text>
              )}

              {members.map((m) => (
                <TouchableOpacity
                  key={m.id}
                  style={styles.memberRow}
                  onPress={() => openEdit(m)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.memberEmoji}>{m.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.memberName}>{m.name}</Text>
                    <Text style={styles.memberMeta}>{memberSubtitle(m)}</Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </TouchableOpacity>
              ))}

              {editorOpen ? (
                <View style={styles.editor}>
                  <Text style={styles.label}>{t("fam.avatarLabel")}</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.emojiRow}
                  >
                    {MEMBER_EMOJIS.map((e) => (
                      <TouchableOpacity
                        key={e}
                        style={[styles.emojiBtn, emoji === e && styles.emojiBtnActive]}
                        onPress={() => setEmoji(e)}
                      >
                        <Text style={styles.emojiBtnText}>{e}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  <Text style={styles.label}>{t("fam.nameLabel")}</Text>
                  <TextInput
                    style={styles.input}
                    value={name}
                    onChangeText={setName}
                    placeholder={t("fam.namePlaceholder")}
                    placeholderTextColor={COLORS.textTertiary}
                    maxLength={40}
                  />

                  <View style={styles.roleRow}>
                    {(["parent", "child"] as const).map((r) => (
                      <TouchableOpacity
                        key={r}
                        style={[styles.roleChip, role === r && styles.roleChipActive]}
                        onPress={() => setRole(r)}
                      >
                        <Text style={[styles.roleChipText, role === r && styles.roleChipTextActive]}>
                          {r === "parent" ? t("fam.roleParent") : t("fam.roleChild")}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {role === "child" && (
                    <>
                      <Text style={styles.label}>{t("fam.ageLabel")}</Text>
                      <TextInput
                        style={styles.input}
                        value={age}
                        onChangeText={(v) => setAge(v.replace(/[^0-9]/g, "").slice(0, 2))}
                        placeholder={t("fam.agePlaceholder")}
                        placeholderTextColor={COLORS.textTertiary}
                        keyboardType="number-pad"
                      />
                    </>
                  )}

                  <Button
                    title={t("fam.saveMember")}
                    onPress={saveMember}
                    loading={saving}
                    disabled={name.trim().length < 1}
                    style={{ marginTop: SPACING.lg }}
                  />
                  {editId && (
                    <TouchableOpacity onPress={onRemove} style={styles.removeBtn} disabled={saving}>
                      <Text style={styles.removeText}>{t("fam.removeMember")}</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => setEditorOpen(false)} style={styles.cancelBtn}>
                    <Text style={styles.cancelText}>{t("common.cancel")}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <Button
                  title={t("fam.addMember")}
                  variant="secondary"
                  onPress={openAdd}
                  style={{ marginTop: SPACING.lg }}
                />
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  topBar: { padding: SPACING.md },
  back: { color: COLORS.accent, fontSize: FONT_SIZE.md, fontWeight: "600" },
  body: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.xxl },
  title: { fontSize: FONT_SIZE.xxl, fontWeight: "800", color: COLORS.textPrimary },
  sub: { color: COLORS.textSecondary, marginTop: SPACING.xs, marginBottom: SPACING.lg, lineHeight: 21 },
  empty: { color: COLORS.textSecondary, marginTop: SPACING.md },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    ...SHADOW.sm,
  },
  memberEmoji: { fontSize: 34 },
  memberName: { fontSize: FONT_SIZE.md, fontWeight: "700", color: COLORS.textPrimary },
  memberMeta: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm, marginTop: 1 },
  chevron: { fontSize: 24, color: COLORS.textTertiary, fontWeight: "300" },
  editor: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginTop: SPACING.sm,
    ...SHADOW.sm,
  },
  label: {
    fontSize: FONT_SIZE.xs,
    fontWeight: "700",
    color: COLORS.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
  emojiRow: { gap: SPACING.sm, paddingVertical: 2 },
  emojiBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emojiBtnActive: { backgroundColor: COLORS.accentLight, borderColor: COLORS.accent },
  emojiBtnText: { fontSize: 24 },
  input: {
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    fontSize: FONT_SIZE.md,
    color: COLORS.textPrimary,
  },
  roleRow: { flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.md },
  roleChip: {
    flex: 1,
    alignItems: "center",
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  roleChipActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  roleChipText: { color: COLORS.textPrimary, fontWeight: "700" },
  roleChipTextActive: { color: "#fff" },
  removeBtn: { alignSelf: "center", marginTop: SPACING.md, padding: SPACING.sm },
  removeText: { color: COLORS.danger, fontWeight: "700" },
  cancelBtn: { alignSelf: "center", marginTop: SPACING.xs, padding: SPACING.sm },
  cancelText: { color: COLORS.textSecondary, fontWeight: "600" },
});
