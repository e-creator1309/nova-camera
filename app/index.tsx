import { CameraView, CameraType, FlashMode, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import * as MediaLibrary from "expo-media-library";
import { Image } from "expo-image";
import { router } from "expo-router";
import React, { useRef, useState, useEffect, useCallback } from "react";
import {
  Animated,
  Dimensions,
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
import { Ionicons, MaterialCommunityIcons, Feather, MaterialIcons } from "@expo/vector-icons";
import * as Linking from "expo-linking";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

type ZoomLevel = { label: string; value: number };
const ZOOM_LEVELS: ZoomLevel[] = [
  { label: ".5", value: 0 },
  { label: "1×", value: 0.01 },
  { label: "3", value: 0.45 },
  { label: "5", value: 0.75 },
];

type CameraMode = "NIGHT" | "PHOTO" | "VIDEO" | "MORE";
const MODES: CameraMode[] = ["NIGHT", "PHOTO", "VIDEO", "MORE"];

export default function CameraScreen() {
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView>(null);
  const shutterAnim = useRef(new Animated.Value(1)).current;

  const [permission, requestPermission] = useCameraPermissions();
  const [mediaPermission, requestMediaPermission] = MediaLibrary.usePermissions();

  const [facing, setFacing] = useState<CameraType>("back");
  const [flash, setFlash] = useState<FlashMode>("off");
  const [zoom, setZoom] = useState(0.01);
  const [zoomIndex, setZoomIndex] = useState(1);
  const [mode, setMode] = useState<CameraMode>("PHOTO");
  const [isTakingPhoto, setIsTakingPhoto] = useState(false);
  const [latestPhoto, setLatestPhoto] = useState<string | null>(null);
  const [timerActive, setTimerActive] = useState(false);
  const [aspectRatio] = useState("3:4");
  const [megapixels] = useState("12M");

  useEffect(() => {
    if (mediaPermission?.granted) {
      loadLatestPhoto();
    }
  }, [mediaPermission]);

  const loadLatestPhoto = async () => {
    try {
      const assets = await MediaLibrary.getAssetsAsync({
        first: 1,
        sortBy: MediaLibrary.SortBy.creationTime,
        mediaType: MediaLibrary.MediaType.photo,
      });
      if (assets.assets.length > 0) {
        setLatestPhoto(assets.assets[0].uri);
      }
    } catch {}
  };

  const handleZoom = (index: number) => {
    setZoomIndex(index);
    setZoom(ZOOM_LEVELS[index].value);
    Haptics.selectionAsync();
  };

  const handleFlipCamera = () => {
    setFacing((f) => (f === "back" ? "front" : "back"));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleFlash = () => {
    setFlash((f) => {
      if (f === "off") return "on";
      if (f === "on") return "auto";
      return "off";
    });
    Haptics.selectionAsync();
  };

  const animateShutter = () => {
    Animated.sequence([
      Animated.timing(shutterAnim, { toValue: 0.85, duration: 80, useNativeDriver: true }),
      Animated.timing(shutterAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();
  };

  const handleShutter = useCallback(async () => {
    if (isTakingPhoto || !cameraRef.current) return;
    if (Platform.OS === "web") return;
    setIsTakingPhoto(true);
    animateShutter();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.9 });
      if (photo && mediaPermission?.granted) {
        await MediaLibrary.saveToLibraryAsync(photo.uri);
        setLatestPhoto(photo.uri);
      }
    } catch {}
    setIsTakingPhoto(false);
  }, [isTakingPhoto, mediaPermission]);

  const flashIcon = () => {
    if (flash === "on") return "flash";
    if (flash === "auto") return "flash-auto";
    return "flash-off";
  };

  if (!permission) {
    return <View style={styles.root} />;
  }

  if (!permission.granted) {
    return (
      <View style={[styles.root, styles.permissionContainer]}>
        <MaterialIcons name="camera-alt" size={64} color="rgba(255,255,255,0.4)" />
        <Text style={styles.permissionTitle}>Camera Access Required</Text>
        <Text style={styles.permissionSub}>
          Allow Camera App to access your camera to take photos and videos.
        </Text>
        <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
          <Text style={styles.permissionBtnText}>Allow Access</Text>
        </TouchableOpacity>
        {!permission.canAskAgain && Platform.OS !== "web" && (
          <TouchableOpacity
            style={[styles.permissionBtn, { backgroundColor: "rgba(255,255,255,0.1)", marginTop: 12 }]}
            onPress={() => {
              try { Linking.openSettings(); } catch {}
            }}
          >
            <Text style={styles.permissionBtnText}>Open Settings</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* Camera Viewfinder */}
      {Platform.OS !== "web" ? (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing={facing}
          flash={flash}
          zoom={zoom}
          mode={mode === "VIDEO" ? "video" : "picture"}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: "#0a0a0a" }]} />
      )}

      {/* Top Controls */}
      <View style={[styles.topBar, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.push("/settings")}>
          <Ionicons name="settings-outline" size={22} color="rgba(255,255,255,0.85)" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.iconBtn} onPress={handleFlash}>
          <MaterialIcons name={flashIcon()} size={22} color="rgba(255,255,255,0.85)" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.iconBtn} onPress={() => setTimerActive((t) => !t)}>
          <MaterialIcons
            name="timer"
            size={22}
            color={timerActive ? "#fff" : "rgba(255,255,255,0.85)"}
          />
        </TouchableOpacity>

        <View style={styles.textBadge}>
          <Text style={styles.badgeText}>{aspectRatio}</Text>
        </View>

        <View style={styles.textBadge}>
          <Text style={styles.badgeText}>{megapixels}</Text>
          <View style={styles.orangeDot} />
        </View>

        <TouchableOpacity style={styles.iconBtn} onPress={() => {}}>
          <MaterialIcons name="slow-motion-video" size={22} color="rgba(255,255,255,0.85)" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.iconBtn} onPress={() => {}}>
          <MaterialCommunityIcons name="layers-outline" size={22} color="rgba(255,255,255,0.85)" />
        </TouchableOpacity>
      </View>

      {/* Bottom Sheet */}
      <View style={[styles.bottomSheet, { paddingBottom: bottomPad + 8 }]}>
        {/* Zoom Selector */}
        <View style={styles.zoomRow}>
          {ZOOM_LEVELS.map((z, i) => (
            <TouchableOpacity
              key={z.label}
              style={[styles.zoomBtn, i === zoomIndex && styles.zoomBtnActive]}
              onPress={() => handleZoom(i)}
            >
              <Text style={[styles.zoomText, i === zoomIndex && styles.zoomTextActive]}>
                {z.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Mode Selector */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.modeRow}
        >
          {MODES.map((m) => (
            <TouchableOpacity key={m} style={styles.modeBtn} onPress={() => { setMode(m); Haptics.selectionAsync(); }}>
              <Text style={[styles.modeText, m === mode && styles.modeTextActive]}>{m}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Controls Row */}
        <View style={styles.controlsRow}>
          {/* Gallery Thumbnail */}
          <TouchableOpacity
            style={styles.galleryBtn}
            onPress={async () => {
              if (!mediaPermission?.granted) {
                await requestMediaPermission();
                return;
              }
              loadLatestPhoto();
            }}
          >
            {latestPhoto ? (
              <Image source={{ uri: latestPhoto }} style={styles.galleryThumb} contentFit="cover" />
            ) : (
              <View style={styles.galleryEmpty}>
                <MaterialIcons name="photo" size={20} color="rgba(255,255,255,0.5)" />
              </View>
            )}
          </TouchableOpacity>

          {/* Shutter Button */}
          <Animated.View style={{ transform: [{ scale: shutterAnim }] }}>
            <TouchableOpacity
              style={[styles.shutter, isTakingPhoto && { opacity: 0.7 }]}
              onPress={handleShutter}
              activeOpacity={0.8}
            >
              <View style={styles.shutterInner} />
            </TouchableOpacity>
          </Animated.View>

          {/* Flip Camera */}
          <TouchableOpacity style={styles.flipBtn} onPress={handleFlipCamera}>
            <MaterialIcons name="flip-camera-android" size={26} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000",
  },
  permissionContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 16,
  },
  permissionTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 16,
  },
  permissionSub: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  permissionBtn: {
    backgroundColor: "#fff",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 50,
    marginTop: 8,
  },
  permissionBtnText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "600",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  textBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  badgeText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 13,
    fontWeight: "500",
  },
  orangeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#FF6A00",
  },
  bottomSheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 16,
    gap: 4,
  },
  zoomRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
    marginBottom: 16,
  },
  zoomBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  zoomBtnActive: {
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  zoomText: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 15,
    fontWeight: "500",
  },
  zoomTextActive: {
    color: "#fff",
    fontWeight: "700",
  },
  modeRow: {
    flexDirection: "row",
    paddingHorizontal: 60,
    gap: 28,
    marginBottom: 24,
    width: "100%",
    justifyContent: "center",
  },
  modeBtn: {
    paddingVertical: 4,
  },
  modeText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
    fontWeight: "500",
    letterSpacing: 0.8,
  },
  modeTextActive: {
    color: "#fff",
    fontWeight: "800",
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 32,
    marginBottom: 8,
  },
  galleryBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
  },
  galleryThumb: {
    width: "100%",
    height: "100%",
  },
  galleryEmpty: {
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  shutter: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.4)",
  },
  shutterInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#fff",
  },
  flipBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
});
