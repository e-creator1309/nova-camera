import { BlurView } from "expo-blur";
import { CameraView, CameraType, FlashMode, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";
import { Image } from "expo-image";
import { router } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Dimensions,
  GestureResponderEvent,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Ionicons,
  MaterialCommunityIcons,
  MaterialIcons,
} from "@expo/vector-icons";
import * as Linking from "expo-linking";

const { width: SW, height: SH } = Dimensions.get("window");

// ─── Types ───────────────────────────────────────────────────────────────────
type CameraMode = "NIGHT" | "PHOTO" | "VIDEO" | "MORE";
type AspectRatio = "9:16" | "FULL" | "3:4" | "1:1";
type ZoomLevel = { label: string; value: number };

const ZOOM_LEVELS: ZoomLevel[] = [
  { label: "0.5×", value: 0 },
  { label: "1", value: 0.01 },
  { label: "3", value: 0.45 },
  { label: "5", value: 0.75 },
];

const ASPECT_RATIOS: AspectRatio[] = ["9:16", "FULL", "3:4", "1:1"];

const MORE_MODES = [
  { id: "pro",          icon: "camera-iris",           label: "PRO",            lib: "mci" },
  { id: "pro_video",    icon: "video-vintage",         label: "PRO VIDEO",      lib: "mci" },
  { id: "single_take",  icon: "camera-burst",          label: "SINGLE TAKE",    lib: "mci" },
  { id: "food",         icon: "silverware-fork-knife", label: "FOOD",           lib: "mci" },
  { id: "panorama",     icon: "panorama",              label: "PANORAMA",       lib: "mi"  },
  { id: "slow_mo",      icon: "slow-motion-video",     label: "SUPER SLOW-MO",  lib: "mi"  },
  { id: "slow_motion",  icon: "timelapse",             label: "SLOW MOTION",    lib: "mi"  },
  { id: "hyperlapse",   icon: "timelapse",             label: "HYPERLAPSE",     lib: "mi"  },
  { id: "portrait_vid", icon: "account-box-outline",   label: "PORTRAIT VIDEO", lib: "mci" },
  { id: "dual_rec",     icon: "picture-in-picture-alt","label": "DUAL RECORDING",lib:"mi"  },
  { id: "portrait",     icon: "face",                  label: "PORTRAIT",       lib: "mi"  },
];

function MoreModeIcon({ icon, lib }: { icon: string; lib: string }) {
  const sz = 28;
  const col = "rgba(255,255,255,0.9)";
  if (lib === "mci")
    return <MaterialCommunityIcons name={icon as any} size={sz} color={col} />;
  return <MaterialIcons name={icon as any} size={sz} color={col} />;
}

// ─── Focus Overlay ───────────────────────────────────────────────────────────
interface FocusProps {
  x: number;
  y: number;
  visible: boolean;
  brightness: number;
  onBrightnessChange: (v: number) => void;
}
function FocusOverlay({ x, y, visible, brightness, onBrightnessChange }: FocusProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const sliderX = useRef(new Animated.Value(brightness * 120)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    } else {
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }).start();
    }
  }, [visible]);

  const sliderPan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderMove: (_, g) => {
          const raw = Math.max(0, Math.min(120, (brightness * 120) + g.dx));
          sliderX.setValue(raw);
          onBrightnessChange(raw / 120);
        },
      }),
    [brightness]
  );

  return (
    <Animated.View
      style={[
        styles.focusContainer,
        { left: x - 40, top: y - 40, opacity },
        !visible && StyleSheet.absoluteFill,
        !visible && { pointerEvents: "none" },
      ]}
      pointerEvents={visible ? "box-none" : "none"}
    >
      {/* Focus ring */}
      <View style={styles.focusRing}>
        <MaterialIcons name="lock" size={12} color="#fff" style={styles.focusLock} />
      </View>
      {/* Brightness slider */}
      <View style={styles.brightnessRow} {...sliderPan.panHandlers}>
        <View style={styles.brightnessTrack}>
          <Animated.View style={[styles.brightnessDot, { left: sliderX }]} />
        </View>
        <MaterialIcons name="wb-sunny" size={14} color="#fff" />
      </View>
    </Animated.View>
  );
}

// ─── More Modal ───────────────────────────────────────────────────────────────
function MoreModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const translateY = useRef(new Animated.Value(SH)).current;
  useEffect(() => {
    Animated.spring(translateY, {
      toValue: visible ? 0 : SH,
      useNativeDriver: true,
      tension: 80,
      friction: 12,
    }).start();
  }, [visible]);

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, { transform: [{ translateY }] }]}
      pointerEvents={visible ? "auto" : "none"}
    >
      <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={styles.moreModal}>
        {/* Bixby Vision */}
        <TouchableOpacity style={styles.bixbyBtn} onPress={onClose}>
          <Text style={styles.bixbyText}>BIXBY VISION</Text>
          <MaterialIcons name="chevron-right" size={18} color="#fff" />
        </TouchableOpacity>

        {/* Modes grid */}
        <View style={styles.modesGrid}>
          {MORE_MODES.map((m) => (
            <TouchableOpacity
              key={m.id}
              style={styles.modeCell}
              onPress={() => { Haptics.selectionAsync(); onClose(); }}
            >
              <View style={styles.modeCellIcon}>
                <MoreModeIcon icon={m.icon} lib={m.lib} />
              </View>
              <Text style={styles.modeCellLabel}>{m.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Mode tabs at bottom */}
        <View style={styles.moreTabRow}>
          {["NIGHT", "PHOTO", "VIDEO", "MORE"].map((t) => (
            <TouchableOpacity key={t} style={styles.moreTabBtn} onPress={onClose}>
              <Text style={[styles.moreTabText, t === "MORE" && styles.moreTabActive]}>
                {t}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.moreTabBtn}>
            <MaterialIcons name="add" size={20} color="rgba(255,255,255,0.6)" />
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}

// ─── Aspect Ratio Picker ──────────────────────────────────────────────────────
function AspectRatioPicker({
  current,
  onSelect,
  onClose,
}: {
  current: AspectRatio;
  onSelect: (r: AspectRatio) => void;
  onClose: () => void;
}) {
  return (
    <View style={styles.arPicker}>
      {ASPECT_RATIOS.map((r) => (
        <TouchableOpacity
          key={r}
          style={[styles.arOption, r === current && styles.arOptionActive]}
          onPress={() => { onSelect(r); onClose(); Haptics.selectionAsync(); }}
        >
          <Text style={[styles.arText, r === current && styles.arTextActive]}>{r}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Shutter Button ───────────────────────────────────────────────────────────
function ShutterButton({
  onPress,
  onLongPress,
  onPressOut,
  isRecording,
}: {
  onPress: () => void;
  onLongPress: () => void;
  onPressOut: () => void;
  isRecording: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const ring = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (isRecording) {
      pulseAnim.current = Animated.loop(
        Animated.sequence([
          Animated.timing(ring, { toValue: 1.12, duration: 700, useNativeDriver: true }),
          Animated.timing(ring, { toValue: 1, duration: 700, useNativeDriver: true }),
        ])
      );
      pulseAnim.current.start();
    } else {
      pulseAnim.current?.stop();
      ring.setValue(1);
    }
    return () => pulseAnim.current?.stop();
  }, [isRecording]);

  const handlePressIn = () => {
    Animated.spring(scale, { toValue: 0.88, useNativeDriver: true, tension: 200, friction: 10 }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 200, friction: 10 }).start();
    onPressOut();
  };

  return (
    <Animated.View style={{ transform: [{ scale: ring }] }}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Pressable
          onPress={onPress}
          onLongPress={onLongPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          delayLongPress={600}
          style={[styles.shutter, isRecording && styles.shutterRecording]}
        >
          {isRecording ? (
            <View style={styles.recordingDot} />
          ) : (
            <View style={styles.shutterInner} />
          )}
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

// ─── Viewfinder dimensions ────────────────────────────────────────────────────
// ─── Zoom helpers ─────────────────────────────────────────────────────────────
function getZoomDisplay(z: number): string {
  if (z <= 0.001) return "0.5×";
  if (z <= 0.01) return `${(0.5 + (z / 0.01) * 0.5).toFixed(1)}×`;
  if (z <= 0.45) return `${(1 + ((z - 0.01) / 0.44) * 2).toFixed(1)}×`;
  if (z <= 0.75) return `${(3 + ((z - 0.45) / 0.30) * 2).toFixed(1)}×`;
  return `${(5 + ((z - 0.75) / 0.25) * 5).toFixed(1)}×`;
}

function ZoomLabel({ opacity, scale, text }: { opacity: Animated.Value; scale: Animated.Value; text: string }) {
  return (
    <Animated.View style={[styles.zoomLabelWrap, { opacity, transform: [{ scale }] }]}>
      <Text style={styles.zoomLabelText}>{text}</Text>
    </Animated.View>
  );
}

function getViewfinderDims(ar: AspectRatio): { width: number; height: number | undefined } {
  switch (ar) {
    case "9:16":
    case "FULL":
      return { width: SW, height: undefined }; // flex:1 handled by parent
    case "3:4":
      return { width: SW, height: SW * (4 / 3) };
    case "1:1":
      return { width: SW, height: SW };
  }
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function CameraScreen() {
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView>(null);

  const [permission, requestPermission] = useCameraPermissions();
  const [mediaPermission, requestMediaPermission] = MediaLibrary.usePermissions();

  const [facing, setFacing] = useState<CameraType>("back");
  const [flash, setFlash] = useState<FlashMode>("off");
  const [zoom, setZoom] = useState(0.01);
  const [zoomIndex, setZoomIndex] = useState(1);
  const [mode, setMode] = useState<CameraMode>("PHOTO");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("3:4");
  const [showARPicker, setShowARPicker] = useState(false);
  const [showMore, setShowMore] = useState(false);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingSecs, setRecordingSecs] = useState(0);
  const recordingTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const [isTakingPhoto, setIsTakingPhoto] = useState(false);
  const [latestPhoto, setLatestPhoto] = useState<string | null>(null);

  // Focus overlay
  const [focusPos, setFocusPos] = useState({ x: 0, y: 0 });
  const [focusVisible, setFocusVisible] = useState(false);
  const [brightness, setBrightness] = useState(0.5);
  const focusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pinch zoom
  const pinchRef = useRef({ dist: 0, baseZoom: zoom });
  const lastHapticZone = useRef(1);

  // Zoom label animation
  const zoomLabelOpacity = useRef(new Animated.Value(0)).current;
  const zoomLabelScale = useRef(new Animated.Value(0.7)).current;
  const [zoomDisplay, setZoomDisplay] = useState("1×");
  const zoomHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  useEffect(() => {
    if (mediaPermission?.granted) loadLatestPhoto();
  }, [mediaPermission]);

  const loadLatestPhoto = async () => {
    try {
      const { assets } = await MediaLibrary.getAssetsAsync({
        first: 1,
        sortBy: MediaLibrary.SortBy.creationTime,
        mediaType: MediaLibrary.MediaType.photo,
      });
      if (assets.length > 0) setLatestPhoto(assets[0].uri);
    } catch {}
  };

  // ── Show zoom label ────────────────────────────────────────────────────────
  const showZoomLabel = useCallback((z: number) => {
    setZoomDisplay(getZoomDisplay(z));
    Animated.parallel([
      Animated.spring(zoomLabelScale, { toValue: 1, useNativeDriver: true, tension: 220, friction: 10 }),
      Animated.timing(zoomLabelOpacity, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();
    if (zoomHideTimer.current) clearTimeout(zoomHideTimer.current);
    zoomHideTimer.current = setTimeout(() => {
      Animated.timing(zoomLabelOpacity, { toValue: 0, duration: 350, useNativeDriver: true }).start(() => {
        zoomLabelScale.setValue(0.7);
      });
    }, 1400);
  }, [zoomLabelOpacity, zoomLabelScale]);

  // ── Pinch-to-zoom ──────────────────────────────────────────────────────────
  const pinchPan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: (e) => e.nativeEvent.touches.length === 2,
        onMoveShouldSetPanResponder: (e) => e.nativeEvent.touches.length === 2,
        onPanResponderGrant: (e) => {
          const t = e.nativeEvent.touches;
          if (t.length === 2) {
            const dx = t[0].pageX - t[1].pageX;
            const dy = t[0].pageY - t[1].pageY;
            pinchRef.current = {
              dist: Math.sqrt(dx * dx + dy * dy),
              baseZoom: zoom,
            };
          }
        },
        onPanResponderMove: (e) => {
          const t = e.nativeEvent.touches;
          if (t.length === 2) {
            const dx = t[0].pageX - t[1].pageX;
            const dy = t[0].pageY - t[1].pageY;
            const newDist = Math.sqrt(dx * dx + dy * dy);
            const rawScale = newDist / pinchRef.current.dist;
            const newZoom = Math.max(0, Math.min(1, pinchRef.current.baseZoom * rawScale));
            setZoom(newZoom);
            showZoomLabel(newZoom);
            // sync zoom pill
            const zone = newZoom <= 0.001 ? 0 : newZoom < 0.25 ? 1 : newZoom < 0.6 ? 2 : 3;
            setZoomIndex(zone);
            // haptic tick when crossing zone boundary
            if (zone !== lastHapticZone.current) {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              lastHapticZone.current = zone;
            }
          }
        },
      }),
    [zoom, showZoomLabel]
  );

  // ── Tap-to-focus ───────────────────────────────────────────────────────────
  const handleViewfinderTap = useCallback(
    (e: GestureResponderEvent) => {
      if (e.nativeEvent.touches && e.nativeEvent.touches.length > 1) return;
      const { pageX, pageY } = e.nativeEvent;
      setFocusPos({ x: pageX, y: pageY });
      setFocusVisible(true);
      Haptics.selectionAsync();
      if (focusTimer.current) clearTimeout(focusTimer.current);
      focusTimer.current = setTimeout(() => setFocusVisible(false), 2500);
    },
    []
  );

  // ── Flash cycle ────────────────────────────────────────────────────────────
  const cycleFlash = () => {
    setFlash((f) => (f === "off" ? "on" : f === "on" ? "auto" : "off"));
    Haptics.selectionAsync();
  };
  const flashIcon = () =>
    flash === "on" ? "flash-on" : flash === "auto" ? "flash-auto" : "flash-off";

  // ── Zoom pill ──────────────────────────────────────────────────────────────
  const handleZoomPill = (i: number) => {
    setZoomIndex(i);
    const v = ZOOM_LEVELS[i].value;
    setZoom(v);
    showZoomLabel(v);
    Haptics.selectionAsync();
  };

  // ── Photo ─────────────────────────────────────────────────────────────────
  const takePhoto = useCallback(async () => {
    if (isTakingPhoto || !cameraRef.current || Platform.OS === "web") return;
    setIsTakingPhoto(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.92 });
      if (photo) {
        if (!mediaPermission?.granted) await requestMediaPermission();
        if (mediaPermission?.granted || (await MediaLibrary.requestPermissionsAsync()).granted) {
          await MediaLibrary.saveToLibraryAsync(photo.uri);
          setLatestPhoto(photo.uri);
        }
      }
    } catch {}
    setIsTakingPhoto(false);
  }, [isTakingPhoto, mediaPermission]);

  // ── Video ──────────────────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    if (!cameraRef.current || Platform.OS === "web") return;
    setIsRecording(true);
    setRecordingSecs(0);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    recordingTimer.current = setInterval(() => setRecordingSecs((s) => s + 1), 1000);
    try {
      const video = await cameraRef.current.recordAsync({ maxDuration: 300 });
      if (video && mediaPermission?.granted) {
        await MediaLibrary.saveToLibraryAsync(video.uri);
        setLatestPhoto(video.uri);
      }
    } catch {}
    clearInterval(recordingTimer.current!);
    setIsRecording(false);
    setRecordingSecs(0);
  }, [mediaPermission]);

  const stopRecording = useCallback(() => {
    if (!isRecording) return;
    cameraRef.current?.stopRecording();
    clearInterval(recordingTimer.current!);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [isRecording]);

  const handleShutterPress = () => {
    if (isRecording) stopRecording();
    else takePhoto();
  };
  const handleShutterLongPress = () => startRecording();
  const handleShutterPressOut = () => {};

  // ── Gallery ────────────────────────────────────────────────────────────────
  const openGallery = async () => {
    Haptics.selectionAsync();
    if (!mediaPermission?.granted) {
      await requestMediaPermission();
      return;
    }
    try {
      await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images", "videos"],
        allowsEditing: false,
        quality: 1,
      });
    } catch {}
  };

  // ── Mode select ────────────────────────────────────────────────────────────
  const handleMode = (m: CameraMode) => {
    if (m === "MORE") { setShowMore(true); return; }
    setMode(m);
    Haptics.selectionAsync();
  };

  // ── Viewfinder sizing ──────────────────────────────────────────────────────
  const vfDims = getViewfinderDims(aspectRatio);
  const isFull = aspectRatio === "9:16" || aspectRatio === "FULL";

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  if (!permission) return <View style={styles.root} />;

  if (!permission.granted) {
    return (
      <View style={[styles.root, styles.permCenter]}>
        <MaterialIcons name="camera-alt" size={64} color="rgba(255,255,255,0.3)" />
        <Text style={styles.permTitle}>Camera Access Required</Text>
        <Text style={styles.permSub}>
          Allow Nova Camera to access your camera to take photos and videos.
        </Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Allow Access</Text>
        </TouchableOpacity>
        {!permission.canAskAgain && Platform.OS !== "web" && (
          <TouchableOpacity
            style={[styles.permBtn, { backgroundColor: "rgba(255,255,255,0.1)", marginTop: 12 }]}
            onPress={() => { try { Linking.openSettings(); } catch {} }}
          >
            <Text style={styles.permBtnText}>Open Settings</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#000" translucent />

      {/* ── Viewfinder ── */}
      <View
        style={[
          styles.viewfinderWrap,
          isFull ? { flex: 1 } : { height: vfDims.height, width: vfDims.width },
        ]}
        {...pinchPan.panHandlers}
        onStartShouldSetResponder={() => true}
        onResponderGrant={handleViewfinderTap}
      >
        {Platform.OS !== "web" ? (
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing={facing}
            flash={flash}
            zoom={zoom}
            mode={isRecording ? "video" : "picture"}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: "#111" }]} />
        )}

        {/* Zoom label overlay */}
        <ZoomLabel opacity={zoomLabelOpacity} scale={zoomLabelScale} text={zoomDisplay} />

        {/* Tap focus overlay */}
        <FocusOverlay
          x={focusPos.x}
          y={focusPos.y}
          visible={focusVisible}
          brightness={brightness}
          onBrightnessChange={setBrightness}
        />

        {/* Recording timer badge */}
        {isRecording && (
          <View style={[styles.recBadge, { top: topPad + 56 }]}>
            <View style={styles.recDot} />
            <Text style={styles.recTime}>{fmt(recordingSecs)}</Text>
          </View>
        )}
      </View>

      {/* ── Top Controls ── */}
      <View style={[styles.topBar, { paddingTop: topPad + 6 }]}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.push("/settings")}>
          <Ionicons name="settings-outline" size={22} color="rgba(255,255,255,0.9)" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} onPress={cycleFlash}>
          <MaterialIcons name={flashIcon()} size={22} color="rgba(255,255,255,0.9)" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn}>
          <MaterialIcons name="timer" size={22} color="rgba(255,255,255,0.9)" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.textBadge}
          onPress={() => { setShowARPicker((p) => !p); setShowMore(false); }}
        >
          <Text style={styles.badgeText}>{aspectRatio}</Text>
        </TouchableOpacity>
        <View style={styles.textBadge}>
          <Text style={styles.badgeText}>12M</Text>
          <View style={styles.orangeDot} />
        </View>
        <TouchableOpacity style={styles.iconBtn}>
          <MaterialIcons name="slow-motion-video" size={22} color="rgba(255,255,255,0.9)" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn}>
          <MaterialCommunityIcons name="layers-outline" size={22} color="rgba(255,255,255,0.9)" />
        </TouchableOpacity>
      </View>

      {/* Aspect ratio picker dropdown */}
      {showARPicker && (
        <AspectRatioPicker
          current={aspectRatio}
          onSelect={setAspectRatio}
          onClose={() => setShowARPicker(false)}
        />
      )}

      {/* ── Bottom Sheet ── */}
      <View style={[styles.bottomSheet, { paddingBottom: bottomPad + 8 }]}>
        {/* Zoom pills */}
        <View style={styles.zoomRow}>
          {ZOOM_LEVELS.map((z, i) => (
            <TouchableOpacity
              key={z.label}
              style={[styles.zoomBtn, i === zoomIndex && styles.zoomBtnActive]}
              onPress={() => handleZoomPill(i)}
            >
              <Text style={[styles.zoomText, i === zoomIndex && styles.zoomTextActive]}>
                {z.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Mode row */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.modeRow}
        >
          {(["NIGHT", "PHOTO", "VIDEO", "MORE"] as CameraMode[]).map((m) => (
            <TouchableOpacity key={m} style={styles.modeBtn} onPress={() => handleMode(m)}>
              <Text style={[styles.modeText, m === mode && styles.modeTextActive]}>{m}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Controls row */}
        <View style={styles.controlsRow}>
          {/* Gallery */}
          <TouchableOpacity style={styles.galleryBtn} onPress={openGallery} activeOpacity={0.8}>
            {latestPhoto ? (
              <Image
                source={{ uri: latestPhoto }}
                style={styles.galleryThumb}
                contentFit="cover"
              />
            ) : (
              <View style={styles.galleryEmpty}>
                <MaterialIcons name="photo" size={20} color="rgba(255,255,255,0.4)" />
              </View>
            )}
          </TouchableOpacity>

          {/* Shutter */}
          <ShutterButton
            onPress={handleShutterPress}
            onLongPress={handleShutterLongPress}
            onPressOut={handleShutterPressOut}
            isRecording={isRecording}
          />

          {/* Flip */}
          <TouchableOpacity
            style={styles.flipBtn}
            onPress={() => { setFacing((f) => (f === "back" ? "front" : "back")); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
          >
            <MaterialIcons name="flip-camera-android" size={26} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* More modal */}
      <MoreModal visible={showMore} onClose={() => setShowMore(false)} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },

  // Permission
  permCenter: { alignItems: "center", justifyContent: "center", paddingHorizontal: 40, gap: 16 },
  permTitle: { color: "#fff", fontSize: 22, fontWeight: "700", textAlign: "center", marginTop: 16 },
  permSub: { color: "rgba(255,255,255,0.55)", fontSize: 15, textAlign: "center", lineHeight: 22 },
  permBtn: { backgroundColor: "#fff", paddingHorizontal: 32, paddingVertical: 14, borderRadius: 50, marginTop: 8 },
  permBtnText: { color: "#000", fontSize: 16, fontWeight: "600" },

  // Viewfinder
  viewfinderWrap: { overflow: "hidden", backgroundColor: "#000" },

  // Top bar
  topBar: {
    position: "absolute",
    top: 0, left: 0, right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  iconBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  textBadge: { flexDirection: "row", alignItems: "center", gap: 3 },
  badgeText: { color: "rgba(255,255,255,0.9)", fontSize: 13, fontWeight: "600" },
  orangeDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: "#FF6A00" },

  // Aspect ratio picker
  arPicker: {
    position: "absolute",
    top: 70,
    alignSelf: "center",
    flexDirection: "row",
    backgroundColor: "rgba(30,30,30,0.92)",
    borderRadius: 20,
    padding: 4,
    gap: 2,
    zIndex: 100,
  },
  arOption: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16 },
  arOptionActive: { backgroundColor: "rgba(255,255,255,0.2)" },
  arText: { color: "rgba(255,255,255,0.55)", fontSize: 13, fontWeight: "500" },
  arTextActive: { color: "#fff", fontWeight: "700" },

  // Bottom sheet
  bottomSheet: { position: "absolute", left: 0, right: 0, bottom: 0, paddingTop: 12 },

  // Zoom
  zoomRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 4, marginBottom: 14 },
  zoomBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  zoomBtnActive: { backgroundColor: "rgba(255,255,255,0.18)" },
  zoomText: { color: "rgba(255,255,255,0.6)", fontSize: 15, fontWeight: "500" },
  zoomTextActive: { color: "#fff", fontWeight: "700" },

  // Mode
  modeRow: { flexDirection: "row", paddingHorizontal: 40, gap: 28, marginBottom: 22, justifyContent: "center", width: "100%" },
  modeBtn: { paddingVertical: 4 },
  modeText: { color: "rgba(255,255,255,0.45)", fontSize: 13, fontWeight: "500", letterSpacing: 0.8 },
  modeTextActive: { color: "#fff", fontWeight: "800" },

  // Controls
  controlsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 32, marginBottom: 10 },
  galleryBtn: { width: 58, height: 58, borderRadius: 29, overflow: "hidden", borderWidth: 2, borderColor: "rgba(255,255,255,0.35)" },
  galleryThumb: { width: "100%", height: "100%" },
  galleryEmpty: { flex: 1, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },

  // Shutter
  shutter: { width: 80, height: 80, borderRadius: 40, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "rgba(255,255,255,0.35)" },
  shutterRecording: { backgroundColor: "rgba(255,255,255,0.15)", borderColor: "#FF3B30", borderWidth: 3 },
  shutterInner: { width: 70, height: 70, borderRadius: 35, backgroundColor: "#fff" },
  recordingDot: { width: 28, height: 28, borderRadius: 6, backgroundColor: "#FF3B30" },

  // Flip
  flipBtn: { width: 58, height: 58, borderRadius: 29, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center" },

  // Focus overlay
  focusContainer: { position: "absolute", alignItems: "center", width: 80 },
  focusRing: { width: 72, height: 72, borderRadius: 36, borderWidth: 1.5, borderColor: "#fff", alignItems: "center", justifyContent: "center" },
  focusLock: { position: "absolute", top: -9 },
  brightnessRow: { flexDirection: "row", alignItems: "center", marginTop: 10, gap: 6 },
  brightnessTrack: { width: 120, height: 2, backgroundColor: "rgba(255,255,255,0.4)", borderRadius: 1, position: "relative" },
  brightnessDot: { position: "absolute", top: -5, width: 12, height: 12, borderRadius: 6, backgroundColor: "#fff", marginLeft: -6 },

  // Zoom label
  zoomLabelWrap: {
    position: "absolute",
    alignSelf: "center",
    top: "42%",
    backgroundColor: "rgba(0,0,0,0.52)",
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  zoomLabelText: { color: "#fff", fontSize: 20, fontWeight: "700", letterSpacing: 0.5 },

  // Recording badge
  recBadge: { position: "absolute", left: 0, right: 0, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 6 },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#FF3B30" },
  recTime: { color: "#fff", fontSize: 15, fontWeight: "700", letterSpacing: 1 },

  // More modal
  moreModal: { flex: 1, paddingTop: 60, paddingHorizontal: 20 },
  bixbyBtn: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.15)", paddingHorizontal: 18, paddingVertical: 10, borderRadius: 24, gap: 4, marginBottom: 36 },
  bixbyText: { color: "#fff", fontSize: 14, fontWeight: "700", letterSpacing: 1 },
  modesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 0 },
  modeCell: { width: (SW - 40) / 3, alignItems: "center", paddingVertical: 20 },
  modeCellIcon: { width: 68, height: 68, borderRadius: 34, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.5)", alignItems: "center", justifyContent: "center", marginBottom: 8 },
  modeCellLabel: { color: "#fff", fontSize: 11, fontWeight: "600", textAlign: "center", letterSpacing: 0.5 },
  moreTabRow: { position: "absolute", bottom: 40, left: 0, right: 0, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 20, paddingHorizontal: 20 },
  moreTabBtn: { paddingVertical: 6 },
  moreTabText: { color: "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: "600", letterSpacing: 0.8 },
  moreTabActive: { color: "#fff", fontWeight: "800" },
});
