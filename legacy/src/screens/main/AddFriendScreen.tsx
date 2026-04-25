import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { BarCodeScanner } from 'expo-barcode-scanner';
import QRCode from 'react-native-qrcode-svg';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '@/contexts/AuthContext';
import { generateQRNonce, sendFriendRequest } from '@/services/firebase/friendService';
import { COLORS, FONT_SIZE, SPACING, RADIUS } from '@/utils/theme';

type Tab = 'myQR' | 'scan';

export function AddFriendScreen() {
  const navigation = useNavigation();
  const { appUser } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('myQR');
  const [qrValue, setQrValue] = useState<string | null>(null);
  const [loadingQR, setLoadingQR] = useState(true);
  const [cameraPermission, setCameraPermission] = useState<boolean | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    if (!appUser) return;
    generateQRNonce(appUser.uid).then((nonce) => {
      // QR encodes: JSON { uid, nonce, ts }
      setQrValue(JSON.stringify({ uid: appUser.uid, nonce, ts: Date.now() }));
      setLoadingQR(false);
    });
  }, [appUser]);

  async function requestCamera() {
    const { status } = await BarCodeScanner.requestPermissionsAsync();
    setCameraPermission(status === 'granted');
    if (status === 'granted') setScanning(true);
  }

  async function handleBarCodeScanned({ data }: { data: string }) {
    if (scanned) return;
    setScanned(true);

    try {
      const payload = JSON.parse(data) as { uid: string; nonce: string; ts: number };

      if (!payload.uid || !payload.nonce) {
        Alert.alert('Invalid QR', 'This QR code is not from PlayPark.');
        setScanned(false);
        return;
      }
      if (payload.uid === appUser?.uid) {
        Alert.alert('That\'s you!', 'Scan a friend\'s QR code, not your own.');
        setScanned(false);
        return;
      }

      await sendFriendRequest({
        fromUserId: appUser!.uid,
        fromDisplayName: appUser!.displayName,
        fromAvatarUrl: appUser!.avatarUrl,
        toUserId: payload.uid,
        nonce: payload.nonce,
      });

      Alert.alert('Friend request sent!', 'They\'ll be added to your friends once they accept.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err: any) {
      const message =
        err.code === 'already-friends'
          ? 'You\'re already friends with this parent.'
          : err.code === 'invalid-nonce'
          ? 'This QR code has expired. Ask them to show a fresh one.'
          : 'Could not send friend request. Try again.';
      Alert.alert('Oops', message);
      setScanned(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add a parent friend</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'myQR' && styles.tabActive]}
          onPress={() => setActiveTab('myQR')}
        >
          <Text style={[styles.tabText, activeTab === 'myQR' && styles.tabTextActive]}>
            My QR Code
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'scan' && styles.tabActive]}
          onPress={() => {
            setActiveTab('scan');
            if (cameraPermission === null) requestCamera();
            else if (cameraPermission) setScanning(true);
          }}
        >
          <Text style={[styles.tabText, activeTab === 'scan' && styles.tabTextActive]}>
            Scan Friend's QR
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'myQR' ? (
        <View style={styles.qrContainer}>
          <Text style={styles.qrInstructions}>
            Show this to a parent friend and ask them to scan it in their PlayPark app.
          </Text>
          {loadingQR || !qrValue ? (
            <ActivityIndicator color={COLORS.primary} size="large" />
          ) : (
            <View style={styles.qrBox}>
              <QRCode value={qrValue} size={220} color={COLORS.textPrimary} />
            </View>
          )}
          <Text style={styles.qrNote}>QR codes expire after 24 hours for security.</Text>
        </View>
      ) : (
        <View style={styles.scanContainer}>
          {cameraPermission === false ? (
            <View style={styles.noCamera}>
              <Text style={styles.noCameraEmoji}>📷</Text>
              <Text style={styles.noCameraText}>Camera access is needed to scan QR codes.</Text>
              <TouchableOpacity style={styles.permissionButton} onPress={requestCamera}>
                <Text style={styles.permissionButtonText}>Allow camera</Text>
              </TouchableOpacity>
            </View>
          ) : scanning ? (
            <>
              <BarCodeScanner
                onBarCodeScanned={handleBarCodeScanned}
                style={styles.scanner}
              />
              <View style={styles.scanOverlay}>
                <View style={styles.scanFrame} />
                <Text style={styles.scanHint}>Point at a friend's PlayPark QR code</Text>
              </View>
              {scanned && (
                <View style={styles.processingOverlay}>
                  <ActivityIndicator color="#fff" size="large" />
                  <Text style={styles.processingText}>Processing…</Text>
                </View>
              )}
            </>
          ) : (
            <TouchableOpacity style={styles.startScanButton} onPress={() => setScanning(true)}>
              <Text style={styles.startScanText}>Start scanning</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  back: { color: COLORS.primary, fontSize: FONT_SIZE.md, marginBottom: SPACING.xs },
  headerTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.textPrimary },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  tab: {
    flex: 1,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: COLORS.primary },
  tabText: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary, fontWeight: '600' },
  tabTextActive: { color: COLORS.primary },
  qrContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
    gap: SPACING.lg,
  },
  qrInstructions: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  qrBox: {
    padding: SPACING.xl,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  qrNote: { fontSize: FONT_SIZE.sm, color: COLORS.textHint, textAlign: 'center' },
  scanContainer: { flex: 1 },
  scanner: { flex: 1 },
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: 220,
    height: 220,
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderRadius: RADIUS.md,
  },
  scanHint: {
    marginTop: SPACING.md,
    color: '#fff',
    fontSize: FONT_SIZE.sm,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.md,
  },
  processingText: { color: '#fff', fontSize: FONT_SIZE.md },
  noCamera: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl, gap: SPACING.md },
  noCameraEmoji: { fontSize: 56 },
  noCameraText: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary, textAlign: 'center' },
  permissionButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
  },
  permissionButtonText: { color: '#fff', fontWeight: '700', fontSize: FONT_SIZE.md },
  startScanButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  startScanText: { color: COLORS.primary, fontSize: FONT_SIZE.lg, fontWeight: '700' },
});
