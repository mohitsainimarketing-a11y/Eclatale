import React, { useEffect, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  ArrowLeft, User, Mic, Link2, CreditCard, Key, Bell, Shield,
  Check, Loader2, ChevronRight, ExternalLink, LogOut, Trash2, Save, Camera,
} from 'lucide-react';
import { SearchableDropdown, ROLES, INDUSTRIES, SENIORITY_LEVELS, TIMEZONES } from '../components/ProfileDropdowns';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL!,
  process.env.REACT_APP_SUPABASE_ANON_KEY!
);

const API_URL = (process.env.REACT_APP_API_URL || 'http://localhost:3001').trim();

type Section = 'profile' | 'voice' | 'integrations' | 'billing' | 'api' | 'notifications' | 'security';

const SECTIONS: { id: Section; label: string; icon: React.ReactNode }[] = [
  { id: 'profile', label: 'Profile', icon: <User size={16} /> },
  { id: 'voice', label: 'Voice Profile', icon: <Mic size={16} /> },
  { id: 'integrations', label: 'Integrations', icon: <Link2 size={16} /> },
  { id: 'billing', label: 'Billing', icon: <CreditCard size={16} /> },
  { id: 'api', label: 'API Access', icon: <Key size={16} /> },
  { id: 'notifications', label: 'Notifications', icon: <Bell size={16} /> },
  { id: 'security', label: 'Security', icon: <Shield size={16} /> },
];

export default function Settings() {
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [section, setSection] = useState<Section>('profile');
  const [loading, setLoading] = useState(true);

  // Profile state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [pronouns, setPronouns] = useState('');
  const [role, setRole] = useState('');
  const [domain, setDomain] = useState('');
  const [seniorityLevel, setSeniorityLevel] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [linkedinUrlManual, setLinkedinUrlManual] = useState('');
  const [bio, setBio] = useState('');
  const [defaultTone, setDefaultTone] = useState('professional');
  const [goals, setGoals] = useState<string[]>([]);
  const [usernameSlug, setUsernameSlug] = useState('');
  const [slugError, setSlugError] = useState('');
  const [timezone, setTimezone] = useState('');
  const [profilePublic, setProfilePublic] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState('');
  const [photoUploading, setPhotoUploading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Voice state
  const [personaStyles, setPersonaStyles] = useState<string[]>([]);
  const [personaExpertise, setPersonaExpertise] = useState('');
  const [personaHotTake, setPersonaHotTake] = useState('');
  const [personaSamples, setPersonaSamples] = useState<string[]>([]);
  const [personaCompleted, setPersonaCompleted] = useState(false);

  // LinkedIn state
  const [linkedinConnected, setLinkedinConnected] = useState(false);
  const [linkedinName, setLinkedinName] = useState('');
  const [linkedinPicture, setLinkedinPicture] = useState('');
  const [linkedinDisconnecting, setLinkedinDisconnecting] = useState(false);

  // Notifications state (local only)
  const [notifDigest, setNotifDigest] = useState(true);
  const [notifReminders, setNotifReminders] = useState(true);
  const [notifPublish, setNotifPublish] = useState(true);

  // Billing state
  const [totalPostsThisMonth, setTotalPostsThisMonth] = useState(0);

  // Delete account state
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { window.location.href = '/login'; return; }
      setUserId(data.user.id);
      setUserEmail(data.user.email || '');
      loadSettings(data.user.id);
    });
  }, []);

  const loadSettings = async (uid: string) => {
    const [profileRes, personaRes, postsRes] = await Promise.all([
      supabase.from('profiles').select('role, domain, goals, first_name, last_name, profile_photo_url, seniority_level, company_name, linkedin_url_manual, bio, username_slug, timezone, default_tone, pronouns, profile_public').eq('id', uid).single(),
      supabase.from('persona_profiles').select('*').eq('user_id', uid).single(),
      supabase.from('posts').select('id').eq('user_id', uid).gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
    ]);

    if (profileRes.data) {
      const p = profileRes.data;
      setFirstName(p.first_name || '');
      setLastName(p.last_name || '');
      setPronouns(p.pronouns || '');
      setRole(p.role || '');
      setDomain(p.domain || '');
      setSeniorityLevel(p.seniority_level || '');
      setCompanyName(p.company_name || '');
      setLinkedinUrlManual(p.linkedin_url_manual || '');
      setBio(p.bio || '');
      setDefaultTone(p.default_tone || 'professional');
      setGoals(p.goals || []);
      setProfilePublic(!!p.profile_public);
      setProfilePhoto(p.profile_photo_url || '');

      // Slug: load existing or auto-suggest from name
      if (p.username_slug) {
        setUsernameSlug(p.username_slug);
      } else if (p.first_name || p.last_name) {
        const suggested = [p.first_name, p.last_name]
          .filter(Boolean).join('-')
          .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        setUsernameSlug(suggested);
      }

      // Timezone: load existing or auto-detect and save
      if (p.timezone) {
        setTimezone(p.timezone);
      } else {
        const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
        setTimezone(detected);
        // Auto-save silently so the user doesn't need to act
        supabase.from('profiles').upsert({ id: uid, timezone: detected }).then(() => {});
      }
    }

    if (personaRes.data) {
      setPersonaStyles(personaRes.data.communication_styles || []);
      setPersonaExpertise(personaRes.data.expertise_topic || '');
      setPersonaHotTake(personaRes.data.contrarian_take || '');
      setPersonaSamples(personaRes.data.voice_samples || []);
      setPersonaCompleted(!!personaRes.data.persona_completed_at);
    }

    setTotalPostsThisMonth(postsRes.data?.length || 0);

    try {
      const liRes = await fetch(`${API_URL}/api/linkedin/status?userId=${uid}`);
      const liData = await liRes.json();
      setLinkedinConnected(liData.connected);
      setLinkedinName(liData.name || '');
      setLinkedinPicture(liData.picture || '');
    } catch {}

    setLoading(false);
  };

  const saveProfile = async () => {
    if (!userId) return;
    setProfileSaving(true);
    setSlugError('');

    // Validate + check uniqueness of slug
    const cleanSlug = usernameSlug.toLowerCase().trim().replace(/[^a-z0-9-]/g, '-').replace(/--+/g, '-').replace(/^-|-$/g, '');
    if (cleanSlug && cleanSlug !== usernameSlug) setUsernameSlug(cleanSlug);

    if (cleanSlug) {
      const { data: existing } = await supabase
        .from('profiles').select('id').eq('username_slug', cleanSlug).neq('id', userId).maybeSingle();
      if (existing) {
        // Find next available alternative
        let suggestion = cleanSlug;
        for (let i = 2; i <= 20; i++) {
          const alt = `${cleanSlug}-${i}`;
          const { data: altExisting } = await supabase
            .from('profiles').select('id').eq('username_slug', alt).neq('id', userId).maybeSingle();
          if (!altExisting) { suggestion = alt; break; }
        }
        setSlugError(`"${cleanSlug}" is already taken. Try "${suggestion}" instead.`);
        setProfileSaving(false);
        return;
      }
    }

    await supabase.from('profiles').upsert({
      id: userId,
      first_name: firstName, last_name: lastName,
      pronouns,
      role, domain,
      seniority_level: seniorityLevel,
      company_name: companyName,
      linkedin_url_manual: linkedinUrlManual,
      bio,
      default_tone: defaultTone,
      goals,
      username_slug: cleanSlug || null,
      timezone,
      profile_public: profilePublic,
    });
    setProfileSaving(false);
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2000);
  };

  const uploadPhoto = async (file: File) => {
    if (!userId) return;
    setPhotoUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${userId}/avatar.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('profile-photos')
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('profile-photos').getPublicUrl(path);
      const url = `${publicUrl}?t=${Date.now()}`;
      await supabase.from('profiles').upsert({ id: userId, profile_photo_url: url });
      setProfilePhoto(url);
    } catch (e) {
      console.error('Photo upload failed:', e);
    }
    setPhotoUploading(false);
  };

  const useLinkedInPhoto = async () => {
    if (!userId || !linkedinPicture) return;
    setPhotoUploading(true);
    await supabase.from('profiles').upsert({ id: userId, profile_photo_url: linkedinPicture });
    setProfilePhoto(linkedinPicture);
    setPhotoUploading(false);
  };

  const disconnectLinkedIn = async () => {
    if (!userId) return;
    setLinkedinDisconnecting(true);
    try {
      await fetch(`${API_URL}/api/linkedin/disconnect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ userId }),
      });
      setLinkedinConnected(false);
      setLinkedinName('');
      setLinkedinPicture('');
    } catch {}
    setLinkedinDisconnecting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen gradient-bg-page flex items-center justify-center">
        <div className="skeleton h-[400px] w-full max-w-4xl" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFE]">
      {/* Header */}
      <nav className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b border-[rgba(124,92,252,0.06)] px-5 md:px-8 h-14 md:h-[72px] flex items-center gap-3">
        <a href="/dashboard" className="p-2 -ml-2 text-brand-muted hover:text-brand-purple transition-colors"><ArrowLeft size={18} /></a>
        <a href="/dashboard" className="text-lg font-extrabold gradient-text">Eclatale</a>
        <span className="text-brand-muted text-sm font-medium ml-2">/ Settings</span>
      </nav>

      <div className="max-w-5xl mx-auto px-5 md:px-8 py-6 md:py-8">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Settings Sidebar */}
          <div className="md:w-[200px] flex-shrink-0">
            <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible pb-2 md:pb-0 md:sticky md:top-24">
              {SECTIONS.map(s => (
                <button
                  key={s.id}
                  onClick={() => setSection(s.id)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                    section === s.id ? 'bg-[rgba(124,92,252,0.06)] text-brand-purple' : 'text-brand-muted hover:text-brand-dark hover:bg-[rgba(124,92,252,0.03)]'
                  }`}
                >
                  {s.icon} {s.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Content Area */}
          <div className="flex-1 min-w-0">
            {/* PROFILE */}
            {section === 'profile' && (
              <div className="animate-fadeIn space-y-5">
                <div>
                  <h2 className="text-xl font-bold text-brand-dark mb-1">Profile</h2>
                  <p className="text-sm text-brand-muted">Manage your identity, professional details, and content preferences.</p>
                </div>

                {/* ── IDENTITY ──────────────────────────────────────── */}
                <div className="card p-6">
                  <p className="text-[11px] font-semibold text-brand-muted uppercase tracking-widest mb-5">Identity</p>

                  {/* Profile card header */}
                  <div className="flex gap-4 mb-6 pb-6 border-b border-[rgba(0,0,0,0.05)]">
                    <div className="relative group flex-shrink-0">
                      <button type="button" onClick={() => photoInputRef.current?.click()}
                        className="relative w-20 h-20 rounded-full overflow-hidden focus:outline-none focus:ring-2 focus:ring-brand-purple focus:ring-offset-2"
                        title="Upload profile photo">
                        {profilePhoto || linkedinPicture
                          ? <img src={profilePhoto || linkedinPicture} alt="Profile" className="w-full h-full object-cover" />
                          : <div className="w-full h-full gradient-primary flex items-center justify-center text-white text-2xl font-bold">
                              {firstName && lastName ? (firstName[0] + lastName[0]).toUpperCase() : (firstName || lastName || userEmail).charAt(0).toUpperCase()}
                            </div>
                        }
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                          {photoUploading ? <Loader2 size={20} className="text-white animate-spin" /> : <Camera size={20} className="text-white" />}
                        </div>
                      </button>
                      <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); e.target.value = ''; }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-bold text-brand-dark leading-tight">
                        {firstName || lastName ? [firstName, lastName].filter(Boolean).join(' ') : userEmail.split('@')[0]}
                        {pronouns && <span className="text-sm font-normal text-brand-muted ml-2">({pronouns})</span>}
                      </p>
                      {(role || companyName) && (
                        <p className="text-sm text-brand-muted mt-0.5">{[role, companyName].filter(Boolean).join(' · ')}</p>
                      )}
                      {bio && <p className="text-sm text-brand-dark/70 mt-1.5 leading-relaxed line-clamp-2">{bio}</p>}
                      <p className="text-xs text-brand-muted mt-1.5">{userEmail}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <button type="button" onClick={() => photoInputRef.current?.click()} disabled={photoUploading}
                          className="text-xs font-semibold text-brand-purple hover:underline disabled:opacity-50">
                          {photoUploading ? 'Uploading…' : 'Upload photo'}
                        </button>
                        {linkedinPicture && !profilePhoto && (
                          <><span className="text-brand-muted text-xs">·</span>
                          <button type="button" onClick={useLinkedInPhoto} disabled={photoUploading}
                            className="text-xs font-semibold text-[#0A66C2] hover:underline disabled:opacity-50">
                            Use LinkedIn photo
                          </button></>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-brand-dark uppercase tracking-wide mb-2 block">First Name</label>
                        <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} className="input" placeholder="First name" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-brand-dark uppercase tracking-wide mb-2 block">Last Name</label>
                        <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} className="input" placeholder="Last name" />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-brand-dark uppercase tracking-wide mb-2 block">
                        Pronouns <span className="normal-case font-normal text-brand-muted">(optional)</span>
                      </label>
                      <input type="text" value={pronouns} onChange={e => setPronouns(e.target.value)}
                        className="input" placeholder="e.g. he/him, she/her, they/them" maxLength={40} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-brand-dark uppercase tracking-wide mb-2 block">Email</label>
                      <input type="email" value={userEmail} disabled className="input !bg-[rgba(124,92,252,0.03)] !text-brand-muted" />
                      <p className="text-[11px] text-brand-muted mt-1">Email is tied to your authentication and cannot be changed here.</p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-brand-dark uppercase tracking-wide mb-2 block">Your Eclatale URL</label>
                      <div className="flex items-center rounded-2xl border border-[rgba(0,0,0,0.1)] overflow-hidden focus-within:border-brand-purple focus-within:ring-2 focus-within:ring-brand-purple/20 transition-all">
                        <span className="px-3 py-2.5 text-sm text-brand-muted bg-[rgba(124,92,252,0.03)] border-r border-[rgba(0,0,0,0.08)] whitespace-nowrap flex-shrink-0">eclatale.com/p/</span>
                        <input type="text" value={usernameSlug}
                          onChange={e => { setUsernameSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/--+/g, '-')); setSlugError(''); }}
                          placeholder="your-name" className="flex-1 px-3 py-2.5 text-sm bg-white outline-none text-brand-dark" maxLength={40} />
                      </div>
                      {slugError
                        ? <p className="text-[11px] text-red-500 mt-1">{slugError}</p>
                        : usernameSlug && <p className="text-[11px] text-brand-muted mt-1">eclatale.com/p/{usernameSlug}</p>
                      }
                    </div>
                    <div className="flex items-center justify-between py-3 px-4 rounded-2xl bg-[rgba(124,92,252,0.03)] border border-[rgba(124,92,252,0.08)]">
                      <div className="flex-1 min-w-0 mr-4">
                        <p className="text-sm font-semibold text-brand-dark">Make my portfolio page public</p>
                        <p className="text-xs text-brand-muted mt-0.5">
                          {usernameSlug
                            ? <>Visible at <span className="text-brand-purple">eclatale.com/p/{usernameSlug}</span> when enabled</>
                            : 'Set a public handle above to enable your portfolio page'}
                        </p>
                      </div>
                      <button type="button" onClick={() => setProfilePublic(v => !v)} disabled={!usernameSlug}
                        className={`w-11 h-6 rounded-full transition-all flex items-center px-0.5 flex-shrink-0 disabled:opacity-40 ${profilePublic ? 'bg-brand-purple justify-end' : 'bg-[rgba(124,92,252,0.15)] justify-start'}`}>
                        <div className="w-5 h-5 rounded-full bg-white shadow-sm transition-all" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* ── PROFESSIONAL DETAILS ──────────────────────────── */}
                <div className="card p-6">
                  <p className="text-[11px] font-semibold text-brand-muted uppercase tracking-widest mb-5">Professional Details</p>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-brand-dark uppercase tracking-wide mb-2 block">Role</label>
                        <SearchableDropdown options={ROLES} value={role} onChange={setRole} placeholder="Search your role..." />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-brand-dark uppercase tracking-wide mb-2 block">Company / Organization</label>
                        <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} className="input" placeholder="e.g. Acme Corp, Freelance" />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-brand-dark uppercase tracking-wide mb-2 block">Industry</label>
                        <SearchableDropdown options={INDUSTRIES} value={domain} onChange={setDomain} placeholder="Search your industry..." />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-brand-dark uppercase tracking-wide mb-2 block">Seniority Level</label>
                        <SearchableDropdown options={SENIORITY_LEVELS} value={seniorityLevel} onChange={setSeniorityLevel} placeholder="Select level..." />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-brand-dark uppercase tracking-wide mb-2 block">Bio / Tagline</label>
                      <input type="text" value={bio} onChange={e => setBio(e.target.value)} className="input" placeholder="1–2 sentence professional summary" maxLength={200} />
                      <p className="text-[11px] text-brand-muted mt-1">{bio.length}/200</p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-brand-dark uppercase tracking-wide mb-2 block">LinkedIn Profile URL</label>
                      <input type="url" value={linkedinUrlManual} onChange={e => setLinkedinUrlManual(e.target.value)} className="input" placeholder="https://linkedin.com/in/yourname" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-brand-dark uppercase tracking-wide mb-2 block">Default Post Tone</label>
                      <div className="flex gap-2 flex-wrap">
                        {[
                          { id: 'professional', label: 'Professional', emoji: '💼' },
                          { id: 'casual',       label: 'Casual',       emoji: '☕' },
                          { id: 'inspirational',label: 'Inspirational',emoji: '🚀' },
                          { id: 'data-driven',  label: 'Data-driven',  emoji: '📊' },
                        ].map(t => (
                          <button key={t.id} type="button" onClick={() => setDefaultTone(t.id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                              defaultTone === t.id
                                ? 'bg-[rgba(124,92,252,0.08)] border-brand-purple text-brand-purple'
                                : 'bg-white border-[rgba(0,0,0,0.1)] text-brand-muted hover:border-brand-purple/40 hover:text-brand-dark'
                            }`}>
                            {t.emoji} {t.label}
                            {defaultTone === t.id && <Check size={11} className="ml-0.5" />}
                          </button>
                        ))}
                      </div>
                      <p className="text-[11px] text-brand-muted mt-1.5">Pre-selected when you open the post composer.</p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-brand-dark uppercase tracking-wide mb-2 block">Timezone</label>
                      <SearchableDropdown options={TIMEZONES} value={timezone} onChange={setTimezone} placeholder="Search timezone..." />
                      <p className="text-[11px] text-brand-muted mt-1">Auto-detected from your browser. Used for scheduled posts.</p>
                    </div>
                  </div>
                </div>

                {/* ── GROWTH GOALS ──────────────────────────────────── */}
                <div className="card p-6">
                  <p className="text-[11px] font-semibold text-brand-muted uppercase tracking-widest mb-4">Growth Goals</p>
                  {goals.length > 0 ? (
                    <div className="flex gap-2 flex-wrap mb-3">
                      {goals.map(g => (
                        <span key={g} className="badge bg-[rgba(124,92,252,0.07)] text-brand-purple text-xs capitalize">{g.replace(/-/g, ' ')}</span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-brand-muted mb-3">No goals set yet.</p>
                  )}
                  <a href="/onboarding" className="text-xs text-brand-purple font-semibold hover:underline">Update goals →</a>
                </div>

                {/* ── SAVE ──────────────────────────────────────────── */}
                <div className="flex items-center gap-3">
                  <button onClick={saveProfile} disabled={profileSaving} className="btn-primary text-sm">
                    {profileSaving ? <Loader2 size={15} className="animate-spin" /> : profileSaved ? <Check size={15} /> : <Save size={15} />}
                    {profileSaving ? 'Saving...' : profileSaved ? 'Saved!' : 'Save Changes'}
                  </button>
                  {profileSaved && <p className="text-xs text-brand-teal font-semibold animate-fadeIn">All changes saved successfully.</p>}
                </div>
              </div>
            )}

            {/* VOICE PROFILE */}
            {section === 'voice' && (
              <div className="animate-fadeIn">
                <h2 className="text-xl font-bold text-brand-dark mb-1">Voice Profile</h2>
                <p className="text-sm text-brand-muted mb-6">Your unique writing voice that shapes every piece of AI content.</p>

                {personaCompleted ? (
                  <div className="card p-6 mb-6">
                    <div className="space-y-4">
                      <div>
                        <span className="text-[11px] font-semibold text-brand-muted uppercase tracking-wide">Communication Style</span>
                        <div className="flex gap-2 mt-1.5 flex-wrap">
                          {personaStyles.map(s => (
                            <span key={s} className="badge bg-[rgba(124,92,252,0.08)] text-brand-purple text-xs">{s}</span>
                          ))}
                        </div>
                      </div>
                      {personaExpertise && (
                        <div>
                          <span className="text-[11px] font-semibold text-brand-muted uppercase tracking-wide">Core Expertise</span>
                          <p className="text-sm font-medium text-brand-dark mt-1">{personaExpertise}</p>
                        </div>
                      )}
                      {personaHotTake && (
                        <div>
                          <span className="text-[11px] font-semibold text-brand-muted uppercase tracking-wide">Contrarian Take</span>
                          <p className="text-sm text-brand-dark mt-1 italic">"{personaHotTake}"</p>
                        </div>
                      )}
                      <div>
                        <span className="text-[11px] font-semibold text-brand-muted uppercase tracking-wide">Voice Samples</span>
                        <p className="text-sm text-brand-dark mt-1">{personaSamples.length} sample{personaSamples.length !== 1 ? 's' : ''} provided</p>
                      </div>
                    </div>
                    <a href="/persona-setup" className="btn-secondary text-sm mt-6 inline-flex">Edit Voice Profile</a>
                  </div>
                ) : (
                  <div className="card p-8 text-center">
                    <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center text-white mx-auto mb-4 opacity-60">
                      <Mic size={24} />
                    </div>
                    <h3 className="text-lg font-bold text-brand-dark mb-2">No voice profile yet</h3>
                    <p className="text-sm text-brand-muted mb-5">Set up your voice profile so AI content sounds like you, not a robot.</p>
                    <a href="/persona-setup" className="btn-primary text-sm">Set Up Voice Profile</a>
                  </div>
                )}
              </div>
            )}

            {/* INTEGRATIONS */}
            {section === 'integrations' && (
              <div className="animate-fadeIn">
                <h2 className="text-xl font-bold text-brand-dark mb-1">Integrations</h2>
                <p className="text-sm text-brand-muted mb-6">Connect your social accounts to publish content directly.</p>

                <div className="space-y-4">
                  {/* LinkedIn */}
                  <div className="card p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-[#0A66C2] flex items-center justify-center text-white text-sm font-bold">in</div>
                        <div>
                          <h3 className="text-sm font-bold text-brand-dark">LinkedIn</h3>
                          {linkedinConnected ? (
                            <div className="flex items-center gap-2 mt-0.5">
                              {linkedinPicture && <img src={linkedinPicture} alt="" className="w-4 h-4 rounded-full" />}
                              <span className="text-xs text-brand-muted">{linkedinName}</span>
                              <span className="text-[10px] font-semibold text-brand-teal bg-[rgba(6,214,160,0.08)] px-1.5 py-0.5 rounded-full">Connected</span>
                            </div>
                          ) : (
                            <p className="text-xs text-brand-muted mt-0.5">Publish posts directly to LinkedIn</p>
                          )}
                        </div>
                      </div>
                      {linkedinConnected ? (
                        <button onClick={disconnectLinkedIn} disabled={linkedinDisconnecting} className="btn-ghost text-xs !py-2 !px-4 !text-red-400 !border-red-100 hover:!bg-red-50">
                          {linkedinDisconnecting ? <Loader2 size={13} className="animate-spin" /> : <LogOut size={13} />}
                          Disconnect
                        </button>
                      ) : (
                        <a href={`${API_URL}/api/auth/linkedin/connect?userId=${userId}`} className="btn-primary text-xs !py-2 !px-4">
                          Connect
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Twitter/X */}
                  <div className="card p-5 opacity-60">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center text-white text-sm font-bold">X</div>
                        <div>
                          <h3 className="text-sm font-bold text-brand-dark">Twitter / X</h3>
                          <p className="text-xs text-brand-muted mt-0.5">Publish threads directly</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-semibold text-brand-muted bg-[rgba(124,92,252,0.06)] px-2.5 py-1 rounded-full">Coming Soon</span>
                    </div>
                  </div>

                  {/* Instagram */}
                  <div className="card p-5 opacity-60">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#833AB4] via-[#FD1D1D] to-[#F77737] flex items-center justify-center text-white text-sm font-bold">ig</div>
                        <div>
                          <h3 className="text-sm font-bold text-brand-dark">Instagram</h3>
                          <p className="text-xs text-brand-muted mt-0.5">Publish captions and carousels</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-semibold text-brand-muted bg-[rgba(124,92,252,0.06)] px-2.5 py-1 rounded-full">Coming Soon</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* BILLING */}
            {section === 'billing' && (
              <div className="animate-fadeIn">
                <h2 className="text-xl font-bold text-brand-dark mb-1">Billing & Subscription</h2>
                <p className="text-sm text-brand-muted mb-6">Manage your plan and view usage.</p>

                <div className="card p-6 mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <span className="text-[11px] font-semibold text-brand-muted uppercase tracking-wide">Current Plan</span>
                      <h3 className="text-lg font-bold text-brand-dark mt-1">Free</h3>
                    </div>
                    <span className="badge bg-[rgba(6,214,160,0.08)] text-brand-teal text-xs">Active</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[rgba(124,92,252,0.08)] mb-2 overflow-hidden">
                    <div className="h-full rounded-full gradient-primary" style={{ width: `${Math.min(100, (totalPostsThisMonth / 10) * 100)}%` }} />
                  </div>
                  <p className="text-xs text-brand-muted mb-4">{totalPostsThisMonth}/10 posts generated this month</p>
                  <button onClick={() => alert('Coming soon! Pro plan launching next month.')} className="btn-primary text-sm">
                    Upgrade to Pro
                  </button>
                </div>

                <div className="card p-6">
                  <h3 className="text-sm font-bold text-brand-dark mb-3">Billing History</h3>
                  <div className="text-center py-6">
                    <p className="text-sm text-brand-muted">No billing history yet.</p>
                  </div>
                </div>
              </div>
            )}

            {/* API ACCESS */}
            {section === 'api' && (
              <div className="animate-fadeIn">
                <h2 className="text-xl font-bold text-brand-dark mb-1">API Access</h2>
                <p className="text-sm text-brand-muted mb-6">Programmatic access to Eclatale's content generation engine.</p>

                <div className="card p-6">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-[rgba(124,92,252,0.06)] flex items-center justify-center">
                      <Key size={18} className="text-brand-purple" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-brand-dark">API Key</h3>
                      <p className="text-xs text-brand-muted">Generate an API key to use Eclatale programmatically</p>
                    </div>
                  </div>
                  <button disabled className="btn-ghost text-sm opacity-50 cursor-not-allowed">
                    <Key size={14} /> Generate API Key
                  </button>
                  <p className="text-[11px] text-brand-muted mt-2">Available on the Pro plan. Upgrade to unlock API access.</p>
                </div>
              </div>
            )}

            {/* NOTIFICATIONS */}
            {section === 'notifications' && (
              <div className="animate-fadeIn">
                <h2 className="text-xl font-bold text-brand-dark mb-1">Notifications</h2>
                <p className="text-sm text-brand-muted mb-6">Control how and when Eclatale reaches out to you.</p>

                <div className="card p-6 space-y-5">
                  {[
                    { label: 'Weekly email digest', desc: 'Summary of your content performance and suggestions', value: notifDigest, set: setNotifDigest },
                    { label: 'Post reminders', desc: 'Gentle nudge when you haven\'t posted in a while', value: notifReminders, set: setNotifReminders },
                    { label: 'Publish confirmations', desc: 'Email confirmation when a post is published to LinkedIn', value: notifPublish, set: setNotifPublish },
                  ].map((n, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-brand-dark">{n.label}</h3>
                        <p className="text-xs text-brand-muted mt-0.5">{n.desc}</p>
                      </div>
                      <button
                        onClick={() => n.set(!n.value)}
                        className={`w-11 h-6 rounded-full transition-all flex items-center px-0.5 ${
                          n.value ? 'bg-brand-purple justify-end' : 'bg-[rgba(124,92,252,0.15)] justify-start'
                        }`}
                      >
                        <div className="w-5 h-5 rounded-full bg-white shadow-sm transition-all" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SECURITY */}
            {section === 'security' && (
              <div className="animate-fadeIn">
                <h2 className="text-xl font-bold text-brand-dark mb-1">Security</h2>
                <p className="text-sm text-brand-muted mb-6">Manage your account security and access.</p>

                <div className="card p-6 mb-6">
                  <h3 className="text-sm font-bold text-brand-dark mb-3">Change Password</h3>
                  <p className="text-sm text-brand-muted mb-4">We'll send a password reset link to your email.</p>
                  <button onClick={async () => {
                    await supabase.auth.resetPasswordForEmail(userEmail);
                    alert('Password reset email sent! Check your inbox.');
                  }} className="btn-secondary text-sm">
                    Send Reset Link
                  </button>
                </div>

                <div className="card p-6 mb-6 opacity-60">
                  <h3 className="text-sm font-bold text-brand-dark mb-2">Active Sessions</h3>
                  <p className="text-sm text-brand-muted">Session management coming soon.</p>
                </div>

                <div className="card p-6 !border-red-100">
                  <h3 className="text-sm font-bold text-red-500 mb-2">Danger Zone</h3>
                  <p className="text-sm text-brand-muted mb-4">Permanently delete your account and all associated data.</p>
                  <button onClick={() => setShowDeleteModal(true)} className="btn-ghost text-sm !text-red-500 !border-red-200 hover:!bg-red-50">
                    <Trash2 size={14} /> Delete Account
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-5">
          <div className="card p-6 max-w-md w-full animate-slideUp">
            <h3 className="text-lg font-bold text-brand-dark mb-2">Delete your account?</h3>
            <p className="text-sm text-brand-muted mb-5">
              This action cannot be undone. All your posts, persona data, and connected accounts will be permanently removed.
            </p>
            <p className="text-sm text-brand-dark mb-5">
              To delete your account, please contact support at <a href="mailto:support@eclatale.com" className="text-brand-purple font-semibold">support@eclatale.com</a>
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowDeleteModal(false)} className="btn-ghost text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
