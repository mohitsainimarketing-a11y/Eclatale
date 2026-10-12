import React, { useState } from 'react';
import { GitBranch, Copy, Check, ExternalLink } from 'lucide-react';
import { apiFetch } from '../../lib/apiFetch';

interface GithubRepo {
  name: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  topics: string[];
  html_url: string;
}

interface GithubProfile {
  login: string;
  name: string | null;
  bio: string | null;
  public_repos: number;
  followers: number;
}

interface PostIdea {
  hook: string;
  angle: string;
  repo: string;
}

interface Result {
  profile: GithubProfile;
  topRepos: GithubRepo[];
  topLanguages: string[];
  skillsToAdd: string[];
  headlineSuggestion: string;
  aboutOpener: string;
  postIdeas: PostIdea[];
  credibilitySignals: string[];
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }
  return (
    <button onClick={copy} className="p-1.5 rounded-lg hover:bg-[rgba(124,92,252,0.08)] text-brand-muted hover:text-brand-purple transition-colors flex-shrink-0">
      {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-bold text-brand-dark mb-3">{title}</p>
      {children}
    </div>
  );
}

export default function GitHubToLinkedIn() {
  const [username, setUsername] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Result | null>(null);

  async function handleAnalyze() {
    const clean = username.trim().replace(/^@/, '').replace(/.*github\.com\//, '');
    if (!clean) { setError('Enter a GitHub username.'); return; }
    setError('');
    setLoading(true);
    setResult(null);
    try {
      const res = await apiFetch('/api/intelligence', {
        method: 'POST',
        body: JSON.stringify({ action: 'github-to-linkedin', username: clean, targetRole }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      setResult(data);
    } catch {
      setError('Something went wrong. Check the username and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-brand-dark mb-1.5">GitHub username</label>
          <div className="relative">
            <GitBranch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted" />
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAnalyze()}
              placeholder="torvalds"
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-[rgba(124,92,252,0.15)] rounded-xl bg-white focus:outline-none focus:border-brand-purple/40 text-brand-dark"
            />
          </div>
          <p className="text-[11px] text-brand-muted mt-1">Public profile only. Paste the URL or just the username.</p>
        </div>
        <div>
          <label className="block text-xs font-bold text-brand-dark mb-1.5">
            Target role <span className="font-normal text-brand-muted">(optional)</span>
          </label>
          <input
            type="text"
            value={targetRole}
            onChange={e => setTargetRole(e.target.value)}
            placeholder="e.g. Senior Backend Engineer, Staff ML Engineer"
            className="w-full px-4 py-2.5 text-sm border border-[rgba(124,92,252,0.15)] rounded-xl bg-white focus:outline-none focus:border-brand-purple/40 text-brand-dark"
          />
          <p className="text-[11px] text-brand-muted mt-1">Helps tailor the headline and skills suggestions.</p>
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">{error}</div>
      )}

      <button
        onClick={handleAnalyze}
        disabled={loading}
        className="btn-primary w-full md:w-auto !px-8 !py-3 text-sm font-bold disabled:opacity-60"
      >
        {loading ? 'Fetching repos and generating…' : 'Generate LinkedIn kit'}
      </button>

      {result && (
        <div className="space-y-4 pt-2">
          {/* Profile summary */}
          <div className="card p-4 flex items-center gap-3">
            <a href={`https://github.com/${result.profile.login}`} target="_blank" rel="noopener noreferrer"
              className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              {(result.profile.name || result.profile.login)[0].toUpperCase()}
            </a>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="font-bold text-sm text-brand-dark">{result.profile.name || result.profile.login}</p>
                <a href={`https://github.com/${result.profile.login}`} target="_blank" rel="noopener noreferrer"
                  className="text-brand-muted hover:text-brand-purple">
                  <ExternalLink size={12} />
                </a>
              </div>
              <p className="text-[11px] text-brand-muted">
                {result.profile.public_repos} repos · {result.profile.followers} followers
                {result.topLanguages.length > 0 && ` · ${result.topLanguages.slice(0, 4).join(', ')}`}
              </p>
            </div>
          </div>

          {/* Top repos */}
          {result.topRepos.length > 0 && (
            <Section title="Top repositories analyzed">
              <div className="flex flex-wrap gap-2">
                {result.topRepos.map((repo, i) => (
                  <a key={i} href={repo.html_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border border-[rgba(124,92,252,0.12)] bg-[rgba(124,92,252,0.03)] text-brand-dark hover:border-brand-purple/30 transition-colors">
                    {repo.name}
                    {repo.stargazers_count > 0 && <span className="text-[10px] text-brand-muted">★{repo.stargazers_count}</span>}
                  </a>
                ))}
              </div>
            </Section>
          )}

          {/* Headline */}
          {result.headlineSuggestion && (
            <Section title="LinkedIn headline">
              <div className="flex items-start gap-2">
                <p className="flex-1 text-sm text-brand-dark leading-relaxed bg-[rgba(124,92,252,0.03)] border border-[rgba(124,92,252,0.1)] rounded-xl px-4 py-3">
                  {result.headlineSuggestion}
                </p>
                <CopyButton text={result.headlineSuggestion} />
              </div>
            </Section>
          )}

          {/* About opener */}
          {result.aboutOpener && (
            <Section title="About section opener">
              <div className="flex items-start gap-2">
                <p className="flex-1 text-sm text-brand-dark leading-relaxed bg-[rgba(124,92,252,0.03)] border border-[rgba(124,92,252,0.1)] rounded-xl px-4 py-3">
                  {result.aboutOpener}
                </p>
                <CopyButton text={result.aboutOpener} />
              </div>
            </Section>
          )}

          {/* Skills */}
          {result.skillsToAdd.length > 0 && (
            <Section title="Skills to add to LinkedIn">
              <div className="flex flex-wrap gap-1.5">
                {result.skillsToAdd.map((skill, i) => (
                  <span key={i} className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[rgba(124,92,252,0.06)] text-brand-purple border border-[rgba(124,92,252,0.12)]">
                    {skill}
                  </span>
                ))}
              </div>
            </Section>
          )}

          {/* Credibility signals */}
          {result.credibilitySignals.length > 0 && (
            <Section title="Credibility signals to mention">
              <ul className="space-y-1.5">
                {result.credibilitySignals.map((signal, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-brand-dark">
                    <span className="text-emerald-500 font-bold mt-0.5 flex-shrink-0">+</span>
                    {signal}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Post ideas */}
          {result.postIdeas.length > 0 && (
            <Section title="Post ideas from your repos">
              <div className="space-y-3">
                {result.postIdeas.map((idea, i) => (
                  <div key={i} className="border border-[rgba(124,92,252,0.1)] rounded-xl p-3 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-brand-dark leading-snug flex-1">{idea.hook}</p>
                      <CopyButton text={idea.hook} />
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] text-brand-muted">{idea.angle}</span>
                      {idea.repo && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[rgba(124,92,252,0.06)] text-brand-purple">
                          {idea.repo}
                        </span>
                      )}
                    </div>
                    <a href={`/create?hook=${encodeURIComponent(idea.hook)}`}
                      className="inline-block mt-1 text-[11px] font-semibold text-brand-purple hover:underline">
                      Write this post in Eclatale
                    </a>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>
      )}
    </div>
  );
}
