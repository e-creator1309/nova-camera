import { Ionicons, MaterialIcons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface ToggleSetting {
  id: string;
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  value: boolean;
  onToggle: (val: boolean) => void;
}

interface SelectSetting {
  id: string;
  icon: React.ReactNode;
  title: string;
  value: string;
  onPress: () => void;
}

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

function ToggleRow({ icon, title, subtitle, value, onToggle }: Omit<ToggleSetting, "id">) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>{icon}</View>
      <View style={styles.rowContent}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={(v) => {
          Haptics.selectionAsync();
          onToggle(v);
        }}
        trackColor={{ false: "#3a3a3c", true: "#1a73e8" }}
        thumbColor="#fff"
        ios_backgroundColor="#3a3a3c"
      />
    </View>
  );
}

function SelectRow({ icon, title, value, onPress }: Omit<SelectSetting, "id">) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.rowIcon}>{icon}</View>
      <View style={styles.rowContent}>
        <Text style={styles.rowTitle}>{title}</Text>
      </View>
      <Text style={styles.rowValue}>{value}</Text>
      <MaterialIcons name="chevron-right" size={20} color="rgba(255,255,255,0.3)" />
    </TouchableOpacity>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  // Intelligent features
  const [sceneOptimizer, setSceneOptimizer] = useState(true);
  const [shotSuggestions, setShotSuggestions] = useState(false);
  const [scanQR, setScanQR] = useState(true);

  // Pictures
  const [gridLines, setGridLines] = useState(false);
  const [locationTags, setLocationTags] = useState(false);
  const [shootingSound, setShootingSound] = useState(true);

  // General
  const [watermark, setWatermark] = useState(false);
  const [scanDocuments, setScanDocuments] = useState(true);
  const [highResPhoto, setHighResPhoto] = useState(false);
  const [stabilization, setStabilization] = useState(true);
  const [hevcVideo, setHevcVideo] = useState(false);

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Camera settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad + 24 }]}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Intelligent features ── */}
        <SectionHeader title="INTELLIGENT FEATURES" />
        <View style={styles.card}>
          <ToggleRow
            icon={<MaterialCommunityIcons name="brain" size={22} color="#4A9EFF" />}
            title="Scene optimizer"
            subtitle="Automatically adjust color and contrast"
            value={sceneOptimizer}
            onToggle={setSceneOptimizer}
          />
          <Divider />
          <ToggleRow
            icon={<MaterialIcons name="auto-awesome" size={22} color="#4A9EFF" />}
            title="Shot suggestions"
            subtitle="Get suggestions for the best shot angle"
            value={shotSuggestions}
            onToggle={setShotSuggestions}
          />
          <Divider />
          <ToggleRow
            icon={<MaterialIcons name="qr-code-scanner" size={22} color="#4A9EFF" />}
            title="Scan QR codes"
            subtitle="Automatically detect and open QR codes"
            value={scanQR}
            onToggle={setScanQR}
          />
        </View>

        {/* ── Pictures ── */}
        <SectionHeader title="PICTURES" />
        <View style={styles.card}>
          <SelectRow
            icon={<MaterialIcons name="aspect-ratio" size={22} color="#4A9EFF" />}
            title="Aspect ratio"
            value="3:4"
            onPress={() => {}}
          />
          <Divider />
          <SelectRow
            icon={<MaterialIcons name="hd" size={22} color="#4A9EFF" />}
            title="Picture resolution"
            value="12MP"
            onPress={() => {}}
          />
          <Divider />
          <ToggleRow
            icon={<MaterialCommunityIcons name="image-filter-hdr" size={22} color="#4A9EFF" />}
            title="High efficiency pictures"
            subtitle="Save as HEIF format to save storage"
            value={highResPhoto}
            onToggle={setHighResPhoto}
          />
        </View>

        {/* ── Videos ── */}
        <SectionHeader title="VIDEOS" />
        <View style={styles.card}>
          <SelectRow
            icon={<MaterialIcons name="videocam" size={22} color="#4A9EFF" />}
            title="Video resolution"
            value="FHD 30fps"
            onPress={() => {}}
          />
          <Divider />
          <ToggleRow
            icon={<MaterialCommunityIcons name="video-stabilization" size={22} color="#4A9EFF" />}
            title="Video stabilization"
            subtitle="Reduces camera shake while recording"
            value={stabilization}
            onToggle={setStabilization}
          />
          <Divider />
          <ToggleRow
            icon={<MaterialCommunityIcons name="movie-open-cog" size={22} color="#4A9EFF" />}
            title="HEVC video (H.265)"
            subtitle="Saves storage but may reduce compatibility"
            value={hevcVideo}
            onToggle={setHevcVideo}
          />
        </View>

        {/* ── General ── */}
        <SectionHeader title="GENERAL" />
        <View style={styles.card}>
          <ToggleRow
            icon={<MaterialCommunityIcons name="watermark" size={22} color="#4A9EFF" />}
            title="Watermark"
            subtitle="Add device model and date to photos"
            value={watermark}
            onToggle={setWatermark}
          />
          <Divider />
          <ToggleRow
            icon={<MaterialIcons name="document-scanner" size={22} color="#4A9EFF" />}
            title="Scan documents"
            subtitle="Auto-detect and enhance document photos"
            value={scanDocuments}
            onToggle={setScanDocuments}
          />
          <Divider />
          <ToggleRow
            icon={<MaterialCommunityIcons name="grid" size={22} color="#4A9EFF" />}
            title="Grid lines"
            subtitle="Show guide lines on the camera preview"
            value={gridLines}
            onToggle={setGridLines}
          />
          <Divider />
          <ToggleRow
            icon={<MaterialIcons name="location-on" size={22} color="#4A9EFF" />}
            title="Location tags"
            subtitle="Add GPS location data to photos"
            value={locationTags}
            onToggle={setLocationTags}
          />
          <Divider />
          <SelectRow
            icon={<Ionicons name="hand-left-outline" size={22} color="#4A9EFF" />}
            title="Shooting methods"
            value=""
            onPress={() => {}}
          />
          <Divider />
          <ToggleRow
            icon={<MaterialIcons name="volume-up" size={22} color="#4A9EFF" />}
            title="Shooting sounds"
            subtitle="Play sound when taking a photo"
            value={shootingSound}
            onToggle={setShootingSound}
          />
          <Divider />
          <SelectRow
            icon={<MaterialIcons name="save" size={22} color="#4A9EFF" />}
            title="Storage location"
            value="Device"
            onPress={() => {}}
          />
        </View>

        {/* Reset */}
        <View style={[styles.card, styles.resetCard]}>
          <TouchableOpacity style={styles.row} onPress={() => {}} activeOpacity={0.7}>
            <View style={styles.rowIcon}>
              <MaterialIcons name="restart-alt" size={22} color="#FF453A" />
            </View>
            <View style={styles.rowContent}>
              <Text style={[styles.rowTitle, { color: "#FF453A" }]}>Reset settings</Text>
            </View>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    gap: 0,
  },
  sectionHeader: {
    color: "#4A9EFF",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.1,
    marginBottom: 8,
    marginTop: 20,
    marginLeft: 4,
  },
  card: {
    backgroundColor: "#1c1c1e",
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 4,
  },
  resetCard: {
    marginTop: 12,
    marginBottom: 0,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 58,
  },
  rowIcon: {
    width: 32,
    alignItems: "center",
    marginRight: 14,
  },
  rowContent: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "500",
  },
  rowSubtitle: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 12,
    lineHeight: 16,
  },
  rowValue: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 14,
    marginRight: 4,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginLeft: 62,
  },
});
