import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import IngestionPanel from './components/IngestionPanel';
import SonarAnalysisPanel from './components/SonarAnalysisPanel';
import EvidenceIntelligencePanel from './components/EvidenceIntelligencePanel';
import HotspotsPanel from './components/HotspotsPanel';
import ReportsPanel from './components/ReportsPanel';
import JudgeWalkthroughModal from './components/JudgeWalkthroughModal';
import { fetchHealth, fetchSurveys, fetchSurveyDetails, loadDemoSurvey } from './api';
import { Radio, Eye, Compass, FileText, ArrowRight, ShieldCheck, ScanEye } from 'lucide-react';

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
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans selection:bg-sky-500 selection:text-white">
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

      {/* Modern Light Footer */}
      <footer className="border-t border-slate-200 bg-white/80 backdrop-blur-sm py-4 px-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <ScanEye size={16} className="text-sky-600" />
            <span className="font-bold text-slate-800">SAGAR NETRA</span>
            <span>• Smart India Hackathon 2026 (#26057)</span>
          </div>

          <div className="flex items-center gap-4 text-[11px]">
            <span>Model: <strong>YOLOv8 + Multi-Evidence Physics Layer</strong></span>
            <span>Target Classes: <strong>Shipwreck • Tyre • Ghost Net</strong></span>
            <span>Coordinates: <strong>Simulated Swath Navigation Grid</strong></span>
          </div>
        </div>
      </footer>

      {/* Judge Walkthrough Modal */}
      <JudgeWalkthroughModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
      />
    </div>
  );
}
