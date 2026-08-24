import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import IngestionPanel from './components/IngestionPanel';
import SonarAnalysisPanel from './components/SonarAnalysisPanel';
import EvidenceIntelligencePanel from './components/EvidenceIntelligencePanel';
import HotspotsPanel from './components/HotspotsPanel';
import ReportsPanel from './components/ReportsPanel';
import JudgeWalkthroughModal from './components/JudgeWalkthroughModal';
import { fetchHealth, fetchSurveys, fetchSurveyDetails, loadDemoSurvey } from './api';
import { Radio, Eye, Compass, FileText, ArrowRight, ShieldCheck } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('ingestion');
  const [health, setHealth] = useState(null);
  const [surveysList, setSurveysList] = useState([]);
  const [currentSurvey, setCurrentSurvey] = useState(null);
  const [surveyImages, setSurveyImages] = useState([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  // Load system health and surveys on mount
  const refreshSystemData = async (targetSurveyId = null) => {
    try {
      const healthData = await fetchHealth();
      setHealth(healthData);

      const surveysData = await fetchSurveys();
      setSurveysList(surveysData.surveys);

      if (surveysData.surveys.length > 0) {
        const activeId = targetSurveyId || currentSurvey?.id || surveysData.surveys[0].id;
        const details = await fetchSurveyDetails(activeId);
        setCurrentSurvey(details.survey);
        setSurveyImages(details.images);
      } else {
        // Auto-load demo survey on very first startup for effortless evaluation
        try {
          const demoRes = await loadDemoSurvey();
          const details = await fetchSurveyDetails(demoRes.data.survey_id);
          setCurrentSurvey(details.survey);
          setSurveyImages(details.images);
          const updatedSurveys = await fetchSurveys();
          setSurveysList(updatedSurveys.surveys);
        } catch (demoErr) {
          console.warn('Initial demo auto-load note:', demoErr);
        }
      }
    } catch (err) {
      console.error('Failed to load initial system data:', err);
    } finally {
      setLoadingInitial(false);
    }
  };

  useEffect(() => {
    refreshSystemData();
  }, []);

  const handleSurveySelect = async (surveyId) => {
    try {
      const details = await fetchSurveyDetails(surveyId);
      setCurrentSurvey(details.survey);
      setSurveyImages(details.images);
    } catch (err) {
      console.error('Failed to select survey:', err);
    }
  };

  const handleSurveyLoaded = (newSurveyId) => {
    refreshSystemData(newSurveyId);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#070c18] text-slate-100 font-sans selection:bg-cyan-500 selection:text-black">
      {/* Top Navbar */}
      <Navbar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        health={health} 
        currentSurvey={currentSurvey}
        onOpenGuide={() => setIsGuideOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {activeTab === 'ingestion' && (
          <IngestionPanel 
            currentSurvey={currentSurvey}
            surveyImages={surveyImages}
            surveysList={surveysList}
            onSurveySelect={handleSurveySelect}
            onSurveyLoaded={handleSurveyLoaded}
          />
        )}

        {activeTab === 'analysis' && (
          <SonarAnalysisPanel
            currentSurvey={currentSurvey}
            surveyImages={surveyImages}
            onSelectEvidenceDetection={() => setActiveTab('evidence')}
          />
        )}

        {activeTab === 'evidence' && (
          <EvidenceIntelligencePanel
            currentSurvey={currentSurvey}
          />
        )}

        {activeTab === 'hotspots' && (
          <HotspotsPanel
            currentSurvey={currentSurvey}
          />
        )}

        {activeTab === 'reports' && (
          <ReportsPanel
            currentSurvey={currentSurvey}
          />
        )}
      </main>

      {/* Embedded Judge Walkthrough & System Architecture Guide */}
      <JudgeWalkthroughModal 
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
      />

      {/* Footer Strip */}
      <footer className="border-t border-slate-800/60 bg-[#060a14] px-6 py-3 text-xs text-slate-500 flex flex-wrap items-center justify-between font-mono">
        <div className="flex items-center gap-2">
          <ShieldCheck size={14} className="text-cyan-400" />
          <span>SONAR-SHIELD v1.0.0 — Smart India Hackathon 2026</span>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsGuideOpen(true)}
            className="text-cyan-400 hover:text-cyan-300 underline cursor-pointer"
          >
            System Guide & Judge Walkthrough
          </button>
          <span>PROTOTYPE DECISION-SUPPORT SYSTEM</span>
        </div>
      </footer>
    </div>
  );
}
