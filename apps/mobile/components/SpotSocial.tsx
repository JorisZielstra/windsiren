import { Link, router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  countRsvpsPerDay,
  createRsvp,
  createSession,
  deleteRsvp,
  getCommentCounts,
  getLikeCounts,
  getLikedSessionIds,
  getPhotosForSessions,
  getPhotoPublicUrl,
  getPublicProfiles,
  isUserRsvpdForDay,
  listSessionsForSpot,
  MAX_PHOTOS_PER_SESSION,
  summarizeWindForToday,
  uploadSessionPhoto,
  type PublicProfile,
} from "@windsiren/core";
import type { Spot } from "@windsiren/shared";
import type { SessionRow } from "@windsiren/supabase";
import { useAuth } from "../lib/auth-context";
import { supabase } from "../lib/supabase";
import { CommentSection } from "./CommentSection";
import { LikeButton } from "./LikeButton";
import { PhotoGrid } from "./PhotoGrid";
import { SessionWindChip } from "./SessionWindChip";

type DayOffset = 0 | 1 | 2;

function dateKeyForOffset(offset: DayOffset): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function dayLabel(offset: DayOffset): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  if (offset === 0) return "Today";
  if (offset === 1) return "Tomorrow";
  return d.toLocaleDateString("en-NL", { weekday: "long" });
}

export function SpotSocial({ spot }: { spot: Spot }) {
  const spotId = spot.id;
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [profiles, setProfiles] = useState<Map<string, PublicProfile>>(new Map());
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [myRsvpByDate, setMyRsvpByDate] = useState<Record<string, boolean>>({});
  const [likeCounts, setLikeCounts] = useState<Map<string, number>>(new Map());
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [photoUrls, setPhotoUrls] = useState<Map<string, string[]>>(new Map());
  const [commentCounts, setCommentCounts] = useState<Map<string, number>>(new Map());
  const [showComposer, setShowComposer] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const today = dateKeyForOffset(0);
    const twoDays = dateKeyForOffset(2);

    const [sessionsList, dayCounts] = await Promise.all([
      listSessionsForSpot(supabase, spotId, 10),
      countRsvpsPerDay(supabase, spotId, today, twoDays),
    ]);
    setSessions(sessionsList);
    setCounts(dayCounts);

    const authorIds = Array.from(new Set(sessionsList.map((s) => s.user_id)));
    const sessionIds = sessionsList.map((s) => s.id);
    const [authorProfiles, sessionLikeCounts, viewerLikedIds, sessionPhotos, sessionCommentCounts] =
      await Promise.all([
        getPublicProfiles(supabase, authorIds),
        getLikeCounts(supabase, sessionIds),
        user
          ? getLikedSessionIds(supabase, user.id, sessionIds)
          : Promise.resolve(new Set<string>()),
        getPhotosForSessions(supabase, sessionIds),
        getCommentCounts(supabase, sessionIds),
      ]);
    setProfiles(authorProfiles);
    setLikeCounts(sessionLikeCounts);
    setLikedIds(viewerLikedIds);
    setCommentCounts(sessionCommentCounts);
    const urlMap = new Map<string, string[]>();
    for (const [sid, photos] of sessionPhotos) {
      urlMap.set(sid, photos.map((p) => getPhotoPublicUrl(supabase, p.storage_path)));
    }
    setPhotoUrls(urlMap);

    if (user) {
      const checks = await Promise.all(
        ([0, 1, 2] as DayOffset[]).map((o) =>
          isUserRsvpdForDay(supabase, user.id, spotId, dateKeyForOffset(o)).then(
            (v) => [dateKeyForOffset(o), v] as const,
          ),
        ),
      );
      setMyRsvpByDate(Object.fromEntries(checks));
    } else {
      setMyRsvpByDate({});
    }

    setLoading(false);
  }, [spotId, user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function toggleRsvp(offset: DayOffset) {
    if (!user) return;
    const dateKey = dateKeyForOffset(offset);
    const already = myRsvpByDate[dateKey];
    if (already) {
      await deleteRsvp(supabase, user.id, spotId, dateKey);
    } else {
      await createRsvp(supabase, user.id, spotId, dateKey);
    }
    refresh();
  }

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionLabel}>Spot activity</Text>
        {user ? (
          <Pressable style={styles.logBtn} onPress={() => setShowComposer(true)}>
            <Text style={styles.logBtnText}>+ Log session</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.logBtn} onPress={() => router.push("/sign-in")}>
            <Text style={styles.logBtnText}>Sign in to post</Text>
          </Pressable>
        )}
      </View>

      <Text style={styles.subLabel}>I&apos;m going</Text>
      <View style={styles.rsvpRow}>
        {([0, 1, 2] as DayOffset[]).map((offset) => {
          const dateKey = dateKeyForOffset(offset);
          const count = counts[dateKey] ?? 0;
          const mine = myRsvpByDate[dateKey];
          return (
            <Pressable
              key={offset}
              onPress={() => (user ? toggleRsvp(offset) : router.push("/sign-in"))}
              style={[styles.rsvpCard, mine ? styles.rsvpCardActive : null]}
            >
              <Text style={styles.rsvpDay}>{dayLabel(offset)}</Text>
              <Text style={styles.rsvpCount}>
                {count} kiter{count === 1 ? "" : "s"} going
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.subLabel, { marginTop: 16 }]}>Recent sessions</Text>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 10 }} />
      ) : sessions.length === 0 ? (
        <Text style={styles.empty}>Nobody has logged a session here yet.</Text>
      ) : (
        sessions.map((s) => {
          const author = profiles.get(s.user_id);
          return (
            <View key={s.id} style={styles.sessionRow}>
              <View style={styles.sessionTopLine}>
                <Link href={`/users/${s.user_id}`} asChild>
                  <Pressable>
                    <Text style={styles.sessionAuthor}>
                      {author?.display_name ?? "Someone"}
                    </Text>
                  </Pressable>
                </Link>
                <Text style={styles.sessionDuration}>{s.duration_minutes} min</Text>
              </View>
              <View style={styles.sessionMetaLine}>
                <Text style={styles.sessionDate}>
                  {new Date(s.session_date).toLocaleDateString("en-NL", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </Text>
                <SessionWindChip session={s} />
              </View>
              {s.notes ? <Text style={styles.sessionNotes}>{s.notes}</Text> : null}
              <PhotoGrid urls={photoUrls.get(s.id) ?? []} />
              <View style={{ marginTop: 8 }}>
                <LikeButton
                  sessionId={s.id}
                  initialCount={likeCounts.get(s.id) ?? 0}
                  initialLiked={likedIds.has(s.id)}
                />
              </View>
              <CommentSection sessionId={s.id} initialCount={commentCounts.get(s.id) ?? 0} />
            </View>
          );
        })
      )}

      <Modal
        visible={showComposer}
        animationType="slide"
        transparent
        onRequestClose={() => setShowComposer(false)}
      >
        {showComposer && user ? (
          <SessionComposer
            spot={spot}
            userId={user.id}
            onClose={() => setShowComposer(false)}
            onCreated={() => {
              setShowComposer(false);
              refresh();
            }}
          />
        ) : null}
      </Modal>
    </View>
  );
}

function SessionComposer({
  spot,
  userId,
  onClose,
  onCreated,
}: {
  spot: Spot;
  userId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const spotId = spot.id;
  const [selectedOffset, setSelectedOffset] = useState<DayOffset>(0);
  const [duration, setDuration] = useState("60");
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pickPhotos() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError("Photo library access denied");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: MAX_PHOTOS_PER_SESSION,
      quality: 0.85,
    });
    if (!result.canceled && result.assets) {
      setPhotos(result.assets.slice(0, MAX_PHOTOS_PER_SESSION));
    }
  }

  async function onSubmit() {
    setBusy(true);
    setError(null);
    const mins = parseInt(duration, 10);

    // For today's sessions, pull a wind summary from Open-Meteo (only —
    // backdated archive lookup is a follow-up).
    const sessionDate = dateKeyForOffset(selectedOffset);
    const isToday = sessionDate === dateKeyForOffset(0);
    const wind = isToday ? await summarizeWindForToday(spot) : null;

    const result = await createSession(supabase, {
      userId,
      spotId,
      sessionDate,
      durationMinutes: mins,
      notes: notes.trim() || null,
      windAvgMs: wind?.windAvgMs ?? null,
      windMaxMs: wind?.windMaxMs ?? null,
      windDirAvgDeg: wind ? Math.round(wind.windDirAvgDeg) : null,
      gustMaxMs: wind?.gustMaxMs ?? null,
    });
    if (!result.ok) {
      setBusy(false);
      setError(result.message);
      return;
    }

    // Upload each picked photo. RN's fetch returns a Blob from a local URI.
    for (let i = 0; i < photos.length; i++) {
      const asset = photos[i]!;
      try {
        const response = await fetch(asset.uri);
        const blob = await response.blob();
        const ext = (asset.fileName?.split(".").pop() ?? asset.uri.split(".").pop() ?? "jpg")
          .toLowerCase();
        const upload = await uploadSessionPhoto(supabase, userId, result.session.id, blob, {
          ordinal: i,
          ext,
          contentType: asset.mimeType ?? `image/${ext === "jpg" ? "jpeg" : ext}`,
        });
        if (!upload.ok) {
          setError(`Session posted; photo ${i + 1} failed: ${upload.message}`);
        }
      } catch (e) {
        setError(`Session posted; photo ${i + 1} failed: ${(e as Error).message}`);
      }
    }

    setBusy(false);
    onCreated();
  }

  return (
    <Pressable style={styles.modalBackdrop} onPress={onClose}>
      <Pressable style={styles.modalCard} onPress={() => {}}>
        <Text style={styles.modalTitle}>Log session</Text>
        <Text style={styles.modalHint}>
          Up to {MAX_PHOTOS_PER_SESSION} photos.
        </Text>

        <Text style={styles.formLabel}>When</Text>
        <View style={styles.dayRow}>
          {([0, 1, 2] as DayOffset[]).map((o) => (
            <Pressable
              key={o}
              onPress={() => setSelectedOffset(o)}
              style={[
                styles.dayChip,
                selectedOffset === o ? styles.dayChipActive : null,
              ]}
            >
              <Text
                style={selectedOffset === o ? styles.dayChipActiveText : styles.dayChipText}
              >
                {dayLabel(o)}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.formLabel}>Duration (minutes)</Text>
        <TextInput
          value={duration}
          onChangeText={setDuration}
          keyboardType="number-pad"
          style={styles.input}
        />

        <Text style={styles.formLabel}>Notes (optional)</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="How was it?"
          placeholderTextColor="#a1a1aa"
          multiline
          maxLength={500}
          style={[styles.input, { height: 80, textAlignVertical: "top" }]}
        />

        <Text style={styles.formLabel}>Photos</Text>
        <Pressable style={styles.pickPhotosBtn} onPress={pickPhotos}>
          <Text style={styles.pickPhotosBtnText}>
            {photos.length === 0
              ? "+ Add photos"
              : `${photos.length} photo${photos.length === 1 ? "" : "s"} selected · tap to change`}
          </Text>
        </Pressable>
        {photos.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbRow}>
            {photos.map((p, i) => (
              <Image key={i} source={{ uri: p.uri }} style={styles.thumb} />
            ))}
          </ScrollView>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.modalActions}>
          <Pressable onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Pressable
            style={[styles.postBtn, busy && { opacity: 0.5 }]}
            onPress={onSubmit}
            disabled={busy}
          >
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.postBtnText}>Post</Text>}
          </Pressable>
        </View>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 24, paddingHorizontal: 0 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  sectionLabel: { fontSize: 10, fontWeight: "700", color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5 },
  logBtn: { borderWidth: 1, borderColor: "#d4d4d8", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  logBtnText: { fontSize: 13, fontWeight: "600", color: "#18181b" },
  subLabel: { fontSize: 10, fontWeight: "700", color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  rsvpRow: { flexDirection: "row", gap: 8 },
  rsvpCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e5e5e5",
    borderRadius: 8,
    padding: 10,
  },
  rsvpCardActive: { borderColor: "#10b981", backgroundColor: "#ecfdf5" },
  rsvpDay: { fontSize: 13, fontWeight: "600", color: "#18181b" },
  rsvpCount: { fontSize: 11, color: "#6b7280", marginTop: 2 },
  empty: { fontSize: 13, color: "#9ca3af", marginTop: 6 },
  sessionRow: {
    borderWidth: 1,
    borderColor: "#e5e5e5",
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  sessionTopLine: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sessionAuthor: { fontSize: 14, fontWeight: "600", color: "#0369a1" },
  sessionDuration: { fontSize: 13, color: "#6b7280", fontVariant: ["tabular-nums"] },
  sessionDate: { fontSize: 11, color: "#6b7280" },
  sessionMetaLine: { marginTop: 2, flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  sessionNotes: { fontSize: 13, color: "#374151", marginTop: 8, lineHeight: 18 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#fff",
    padding: 20,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 32,
  },
  modalTitle: { fontSize: 18, fontWeight: "700" },
  modalHint: { fontSize: 12, color: "#6b7280", marginTop: 4 },
  formLabel: { fontSize: 12, fontWeight: "500", color: "#374151", marginTop: 16, marginBottom: 4 },
  dayRow: { flexDirection: "row", gap: 6 },
  dayChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#d4d4d8",
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: "center",
  },
  dayChipActive: { borderColor: "#18181b", backgroundColor: "#18181b" },
  dayChipText: { fontSize: 13, color: "#18181b" },
  dayChipActiveText: { fontSize: 13, color: "#fff", fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderColor: "#d4d4d8",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 15,
  },
  error: { color: "#b91c1c", marginTop: 12, fontSize: 13 },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 16, marginTop: 20 },
  cancelText: { fontSize: 14, color: "#6b7280" },
  postBtn: { backgroundColor: "#18181b", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 6 },
  postBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  pickPhotosBtn: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#a1a1aa",
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: "center",
  },
  pickPhotosBtnText: { fontSize: 13, color: "#52525b", fontWeight: "500" },
  thumbRow: { marginTop: 8, flexDirection: "row" },
  thumb: { width: 60, height: 60, borderRadius: 6, marginRight: 8, backgroundColor: "#f4f4f5" },
});
