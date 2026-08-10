import React from 'react';
import { useParams, Navigate } from 'react-router-dom';
import Seo from '../../components/Seo';
import ToolShell from './ToolShell';
import { getTool } from './config';
import HookGenerator from './HookGenerator';
import PostGenerator from './PostGenerator';
import HeadlineAnalyzer from './HeadlineAnalyzer';
import ViralScoreChecker from './ViralScoreChecker';
import EngagementCalculator from './EngagementCalculator';
import ReadabilityChecker from './ReadabilityChecker';
import AboutGenerator from './AboutGenerator';
import CtaGenerator from './CtaGenerator';
import PostLengthAnalyzer from './PostLengthAnalyzer';

const COMPONENTS: Record<string, React.ComponentType> = {
  'hook-generator': HookGenerator,
  'post-generator': PostGenerator,
  'headline-analyzer': HeadlineAnalyzer,
  'viral-score': ViralScoreChecker,
  'engagement-calculator': EngagementCalculator,
  'readability-checker': ReadabilityChecker,
  'about-generator': AboutGenerator,
  'cta-generator': CtaGenerator,
  'post-length-analyzer': PostLengthAnalyzer,
};

export default function ToolPage() {
  const { toolSlug } = useParams<{ toolSlug: string }>();
  const tool = toolSlug ? getTool(toolSlug) : undefined;
  const ToolComponent = toolSlug ? COMPONENTS[toolSlug] : undefined;

  if (!tool || !ToolComponent) return <Navigate to="/tools" replace />;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: tool.name,
    applicationCategory: 'BusinessApplication',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    description: tool.seoDescription,
  };

  return (
    <>
      <Seo
        title={`${tool.name} — Free LinkedIn ${tool.name.replace('LinkedIn ', '')} | Eclatale`}
        description={tool.seoDescription}
        path={`/tools/${tool.slug}`}
        jsonLd={jsonLd}
      />
      <ToolShell tool={tool}>
        <ToolComponent />
      </ToolShell>
    </>
  );
}
