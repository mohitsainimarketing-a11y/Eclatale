import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import Sidebar, { MobileHeader } from '../components/Sidebar';
import { useSidebar } from '../contexts/SidebarContext';
import { apiFetch } from '../lib/apiFetch';
import PhaseNav from './create/PhaseNav';
import Phase0Picker from './create/Phase0Picker';
import Phase1Angles from './create/Phase1Angles';
import Phase2Editor from './create/Phase2Editor';
import Phase3Publish from './create/Phase3Publish';
import { Angle, Source, PostLength } from './create/types';
import { consumePendingDemo } from '../lib/pendingDemo';

const API_URL = (process.env.REACT_APP_API_URL || 'http://localhost:3001').trim();

const LAST_ANGLE_STORAGE_KEY = 'eclatale_create_last_angle';
const LENGTH_STORAGE_KEY = 'eclatale_create_length';
type Phase = 0 | 1 | 2 | 3;

export default function CreatePost() {
  const { sidebarWidth, breakpoint } = useSidebar();

  const [userId, setUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState('');
  const [userDomain, setUserDomain] = useState('');
  const [preferredTone, setPreferredTone] = useState('professional');
  const [userName, setUserName] = useState('');
  const [userInitials, setUserInitials] = useState('Y');
  const [userAvatar, setUserAvatar] = useState('');

  const [currentPhase, setCurrentPhase] = useState<Phase>(0);
  const [phaseTransitioning, setPhaseTransitioning] = useState(false);

  // Angle picker state
  const [angles, setAngles] = useState<Angle[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [anglesLoading, setAnglesLoading] = useState(true);
  const [anglesError, setAnglesError] = useState('');
  const [anglesUpdatedAt, setAnglesUpdatedAt] = useState<string | null>(null);
  const [selectedAngle, setSelectedAngle] = useState<Angle | null>(null);
  const [customInput, setCustomInput] = useState('');

  // Editor state (populated by Phase 1 handoff or ?postId= edit-mode)
  const [postId, setPostId] = useState<string | null>(null);
  const [initialContent, setInitialContent] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [preloadedSpark, setPreloadedSpark] = useState('');
  // Style the visitor picked on the homepage demo chip, carried through signup.
  const [presetStyleId, setPresetStyleId] = useState('');
  const [selectedLength, setSelectedLength] = useState<PostLength>(() => {
    try { return (localStorage.getItem(LENGTH_STORAGE_KEY) as PostLength) || 'short'; } catch { return 'short'; }
  });

  // Publish handoff (Phase 3)
  const [publishedPostUrn, setPublishedPostUrn] = useState('');

  const fetchAngles = useCallback(async (uid: string, forceRefresh: boolean) => {
    setAnglesLoading(true);
    setAnglesError('');
    try {
      const res = await apiFetch(`${API_URL}/api/create/angles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ userId: uid, refresh: forceRefresh }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setAngles(data.angles || []);
      setSources(data.sources || []);
      setAnglesUpdatedAt(data.generatedAt || new Date().toISOString());

      const lastAngleId = localStorage.getItem(LAST_ANGLE_STORAGE_KEY);
      const restored = (data.angles || []).find((a: Angle) => a.id === lastAngleId);
      const first = restored || (data.angles || [])[0] || null;
      setSelectedAngle(first);
    } catch (e: any) {
      setAnglesError(e.message || "Couldn't load angles — try refreshing.");
    }
    setAnglesLoading(false);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const editPostId = params.get('postId');

    supabase.auth.getUser().then(async ({ data }) => {
      const u = data.user;
      if (!u) { window.location.href = '/login'; return; }
      setUserId(u.id);

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, domain, default_tone, first_name, last_name, profile_photo_url')
        .eq('id', u.id)
        .single();
      if (profile?.role) setUserRole(profile.role);
      if (profile?.domain) setUserDomain(profile.domain);
      if (profile?.default_tone) setPreferredTone(profile.default_tone);
      const fn = (profile?.first_name || '').trim();
      const ln = (profile?.last_name || '').trim();
      const name = [fn, ln].filter(Boolean).join(' ') || (u.email?.split('@')[0] || 'You');
      setUserName(name);
      setUserInitials(fn && ln ? (fn[0] + ln[0]).toUpperCase() : name.substring(0, 2).toUpperCase());
      if (profile?.profile_photo_url) setUserAvatar(profile.profile_photo_url);

      if (editPostId) {
        setEditMode(true);
        const { data: post } = await supabase
          .from('posts')
          .select('id, content')
          .eq('id', editPostId)
          .eq('user_id', u.id)
          .single();
        if (post) {
          setPostId(post.id);
          setInitialContent(post.content || '');
          setCurrentPhase(2);
        }
        setAnglesLoading(false);
        return;
      }

      // Homepage demo handoff: they picked this topic before signing up, so
      // drop them straight into the editor on it rather than making them
      // re-pick. Phase 2 generates from customTopic on mount.
      const pending = consumePendingDemo();
      if (pending) {
        setCustomInput(pending.topic);
        setPresetStyleId(pending.style);
        setSelectedAngle(null);
        setCurrentPhase(2);
        setAnglesLoading(false);
        // Still warm the angles cache so "back" lands on a populated Phase 1.
        fetchAngles(u.id, false);
        return;
      }

      // Background-fetch angles so Phase 1 is ready when user arrives
      fetchAngles(u.id, false);
    });
  }, [fetchAngles]);

  const goToPhase = (phase: Phase) => {
    setPhaseTransitioning(true);
    setTimeout(() => {
      setCurrentPhase(phase);
      setPhaseTransitioning(false);
    }, 200);
  };

  const handleSelectAngle = (angle: Angle) => {
    setSelectedAngle(angle);
    setCustomInput('');
    try { localStorage.setItem(LAST_ANGLE_STORAGE_KEY, angle.id); } catch {}
  };

  const handleCustomInputChange = (v: string) => {
    setCustomInput(v);
    if (v) setSelectedAngle(null);
  };

  const handleRefreshAngles = async () => {
    if (!userId) return;
    await fetchAngles(userId, true);
  };

  const canContinue = !!(selectedAngle || customInput.trim());

  const handleContinueToPhase2 = () => {
    if (!canContinue) return;
    setEditMode(false);
    setPostId(null);
    setInitialContent('');
    setPreloadedSpark('');
    goToPhase(2);
  };

  const handleLengthChange = (l: PostLength) => {
    setSelectedLength(l);
    try { localStorage.setItem(LENGTH_STORAGE_KEY, l); } catch {}
  };

  const handleBackToAngles = () => goToPhase(1);
  const handleBackToPicker = () => goToPhase(0);

  const handlePublished = (id: string, urn: string) => {
    setPostId(id);
    setPublishedPostUrn(urn);
    goToPhase(3);
  };

  const handleDraftTomorrow = (angle: Angle) => {
    setSelectedAngle(angle);
    setCustomInput('');
    try { localStorage.setItem(LAST_ANGLE_STORAGE_KEY, angle.id); } catch {}
    setEditMode(false);
    setPostId(null);
    setInitialContent('');
    setPublishedPostUrn('');
    goToPhase(1);
  };

  const handleMaybeLater = () => { window.location.href = '/dashboard'; };

  // Phase 0 handlers
  const handleGoIdeas = () => {
    goToPhase(1);
  };

  const handleGoTrending = (topic: string) => {
    if (topic) {
      setCustomInput(topic);
      setSelectedAngle(null);
    }
    goToPhase(1);
  };

  const handleGoRepurpose = (spark: string) => {
    setPreloadedSpark(spark);
    setEditMode(false);
    setPostId(null);
    setInitialContent('');
    // Use customInput as topic hint
    setCustomInput('repurposed content');
    setSelectedAngle(null);
    goToPhase(2);
  };

  const handleGoIdea = (ideaAngles: Angle[], ideaSources: Source[]) => {
    if (ideaAngles.length > 0) {
      setAngles(ideaAngles);
      setSources(ideaSources);
      setAnglesUpdatedAt(new Date().toISOString());
      setSelectedAngle(ideaAngles[0]);
      setCustomInput('');
    }
    goToPhase(1);
  };

  const voiceLabel = `${preferredTone.charAt(0).toUpperCase()}${preferredTone.slice(1)}${userDomain ? ' · ' + userDomain : ''}`;
  const contentOffset = breakpoint === 'mobile' ? 0 : sidebarWidth;

  return (
    <div className="h-app-shell flex flex-col" style={{ marginLeft: contentOffset, background: '#F4F0FF', transition: 'margin-left 0.2s ease' }}>
      <Sidebar />
      <MobileHeader title="Create" />
      {currentPhase > 0 && !editMode && (
        <div className="bg-white border-b border-[rgba(124,92,252,0.06)] px-4 py-1.5 flex items-center">
          <button
            onClick={handleBackToPicker}
            className="text-[12px] font-semibold text-brand-muted hover:text-brand-purple transition-colors flex items-center gap-1"
          >
            ← Change starting point
          </button>
        </div>
      )}
      <PhaseNav currentPhase={currentPhase} />
      <div className="flex-1 min-h-0 flex flex-col" style={{ opacity: phaseTransitioning ? 0 : 1, transition: 'opacity 0.2s ease' }}>
        {currentPhase === 0 && userId && (
          <Phase0Picker
            userId={userId}
            firstName={userName}
            voiceLabel={voiceLabel}
            onGoIdeas={handleGoIdeas}
            onGoTrending={handleGoTrending}
            onGoRepurpose={handleGoRepurpose}
            onGoIdea={handleGoIdea}
          />
        )}
        {currentPhase === 1 && (
          <Phase1Angles
            userId={userId || ''}
            userRole={userRole}
            userDomain={userDomain}
            angles={angles}
            loading={anglesLoading}
            error={anglesError}
            updatedAt={anglesUpdatedAt}
            selectedAngleId={selectedAngle?.id || null}
            onSelectAngle={handleSelectAngle}
            onRefresh={handleRefreshAngles}
            customInput={customInput}
            onCustomInputChange={handleCustomInputChange}
            voiceLabel={voiceLabel}
            onContinue={handleContinueToPhase2}
            canContinue={canContinue}
          />
        )}
        {currentPhase === 2 && userId && (
          <Phase2Editor
            userId={userId}
            userName={userName}
            userInitials={userInitials}
            userRole={userRole}
            userDomain={userDomain}
            userAvatar={userAvatar}
            angle={editMode ? null : selectedAngle}
            customTopic={editMode ? '' : customInput}
            sources={sources}
            editMode={editMode}
            initialPostId={postId}
            initialContent={initialContent}
            selectedLength={selectedLength}
            onLengthChange={handleLengthChange}
            onBack={handleBackToAngles}
            onPublished={handlePublished}
            preloadedSpark={preloadedSpark || undefined}
            presetStyleId={presetStyleId || undefined}
          />
        )}
        {currentPhase === 3 && userId && (
          <Phase3Publish
            userId={userId}
            publishedPostUrn={publishedPostUrn}
            linkedinConnected
            angles={angles}
            selectedAngle={selectedAngle}
            onDraftTomorrow={handleDraftTomorrow}
            onMaybeLater={handleMaybeLater}
          />
        )}
      </div>
    </div>
  );
}
