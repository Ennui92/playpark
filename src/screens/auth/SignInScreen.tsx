import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { LanguagePicker } from "@/components/LanguagePicker";
import { sendEmailOtp, verifyEmailOtp } from "@/services/auth";
import { useT } from "@/i18n";
import { COLORS, FONT_SIZE, RADIUS, SPACING } from "@/utils/theme";

export function SignInScreen() {
  const t = useT();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"email" | "code">("email");
  const [loading, setLoading] = useState(false);

  async function requestCode() {
    if (!email.trim()) return;
    setLoading(true);
    // Fire-and-forget. Real send may 429/fail — the dev code 123456 works
    // either way, so we always advance.
    sendEmailOtp(email.trim().toLowerCase()).catch(() => {});
    setStage("code");
    setLoading(false);
  }

  async function submitCode() {
    if (code.length < 6) return;
    setLoading(true);
    try {
      await verifyEmailOtp(email.trim().toLowerCase(), code.trim());
      // SessionContext will pick up the new session automatically.
    } catch (e: any) {
      Alert.alert(t("signin.invalidCode"), e.message ?? t("signin.checkEmail"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.logo}>🌤️</Text>
          <Text style={styles.title}>Outside</Text>
          <Text style={styles.tagline}>{t("signin.tagline")}</Text>

          {stage === "email" ? (
            <>
              <TextInput
                style={styles.input}
                placeholder={t("signin.emailPlaceholder")}
                placeholderTextColor={COLORS.textTertiary}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
              />
              <Button
                title={t("signin.sendCode")}
                onPress={requestCode}
                loading={loading}
                disabled={!email.includes("@")}
                style={{ marginTop: SPACING.md }}
              />
              <View style={{ marginTop: SPACING.xl }}>
                <LanguagePicker />
              </View>
            </>
          ) : (
            <>
              <Text style={styles.hint}>{t("signin.codeSentTo", { email })}</Text>
              <Text style={styles.devHint}>{t("signin.devHint")}</Text>
              <TextInput
                style={[styles.input, styles.codeInput]}
                placeholder="123456"
                placeholderTextColor={COLORS.textTertiary}
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                maxLength={6}
              />
              <Button
                title={t("signin.verify")}
                onPress={submitCode}
                loading={loading}
                disabled={code.length < 6}
                style={{ marginTop: SPACING.md }}
              />
              <Button
                title={t("signin.differentEmail")}
                variant="ghost"
                onPress={() => {
                  setStage("email");
                  setCode("");
                }}
                style={{ marginTop: SPACING.sm }}
              />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  body: { flexGrow: 1, padding: SPACING.xl, justifyContent: "center" },
  logo: { fontSize: 72, textAlign: "center", marginBottom: SPACING.md },
  title: {
    fontSize: FONT_SIZE.display,
    fontWeight: "800",
    color: COLORS.textPrimary,
    textAlign: "center",
  },
  tagline: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginTop: SPACING.xs,
    marginBottom: SPACING.xxl,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    fontSize: FONT_SIZE.md,
    color: COLORS.textPrimary,
  },
  codeInput: { textAlign: "center", fontSize: FONT_SIZE.xxl, letterSpacing: 8 },
  hint: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.sm,
    textAlign: "center",
    marginBottom: SPACING.md,
  },
  devHint: {
    color: COLORS.warn,
    fontSize: FONT_SIZE.xs,
    textAlign: "center",
    marginBottom: SPACING.sm,
    fontStyle: "italic",
  },
});
