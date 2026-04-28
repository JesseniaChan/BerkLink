import React, { useState} from 'react';
import StudentInfo from './StudentInfo';
import Availability from './Availability';
import Classes from './Classes';
import StudyLocations from './StudyLocations';
import { markOnboardingComplete } from '../services/onboardingService';
import '../styles/OnboardingWrapper.css';

const ONBOARDING_STEPS = [
  {
    id: 'contact',
    title: 'Contact Information',
    description: 'Step 1 of 4',
    component: StudentInfo,
  },
  {
    id: 'availability',
    title: 'Availability',
    description: 'Step 2 of 4',
    component: Availability,
  },
  {
    id: 'classes',
    title: 'Classes',
    description: 'Step 3 of 4',
    component: Classes,
  },
  {
    id: 'locations',
    title: 'Study Spots',
    description: 'Step 4 of 4',
    component: StudyLocations,
  },
];

export default function OnboardingWrapper({ userId, onComplete }) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [completedSteps, setCompletedSteps] = useState(new Set());
  const [isMarking, setIsMarking] = useState(false);

  const currentStep = ONBOARDING_STEPS[currentStepIndex];
  const CurrentComponent = currentStep.component;

  const handleStepNext = async (data) => {
    console.log(`${currentStep.id} completed:`, data);

    // Mark this step as completed
    const newCompletedSteps = new Set(completedSteps);
    newCompletedSteps.add(currentStep.id);
    setCompletedSteps(newCompletedSteps);

    // Move to next step or complete onboarding
    if (currentStepIndex < ONBOARDING_STEPS.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    } else {
      // All steps completed - mark onboarding as complete
      await completeOnboarding();
    }
  };

  const handleStepSkip = () => {
    console.log(`${currentStep.id} skipped`);

    // Mark this step as completed even if skipped
    const newCompletedSteps = new Set(completedSteps);
    newCompletedSteps.add(currentStep.id);
    setCompletedSteps(newCompletedSteps);

    // Move to next step or complete onboarding
    if (currentStepIndex < ONBOARDING_STEPS.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    } else {
      // All steps completed - mark onboarding as complete
      completeOnboarding();
    }
  };

  const completeOnboarding = async () => {
    try {
      setIsMarking(true);
      console.log('Marking onboarding as complete...');

      await markOnboardingComplete(userId);

      console.log('Onboarding marked as complete in Supabase');

      // Call the parent callback
      if (onComplete) {
        onComplete();
      }
    } catch (err) {
      console.error('Error completing onboarding:', err);
      // Continue anyway - don't block the user
      if (onComplete) {
        onComplete();
      }
    } finally {
      setIsMarking(false);
    }
  };

  const goToPreviousStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  const canGoPrevious = currentStepIndex > 0;

  return (
    <div className="onboarding-wrapper">
      {/* Progress Bar */}
      <div className="onboarding-progress">
        <div className="progress-container">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{
                width: `${((currentStepIndex + 1) / ONBOARDING_STEPS.length) * 100}%`,
              }}
            />
          </div>
        </div>

        {/* Step Indicators */}
        <div className="step-indicators">
          {ONBOARDING_STEPS.map((step, index) => (
            <div
              key={step.id}
              className={`step-indicator ${
                index < currentStepIndex
                  ? 'completed'
                  : index === currentStepIndex
                  ? 'active'
                  : ''
              }`}
              title={step.title}
            >
              {index < currentStepIndex ? (
                <span className="step-check">✓</span>
              ) : (
                <span className="step-number">{index + 1}</span>
              )}
            </div>
          ))}
        </div>

        {/* Step Title and Description */}
        <div className="step-info">
          <h3 className="step-title">{currentStep.title}</h3>
          <p className="step-description">{currentStep.description}</p>
        </div>
      </div>

      {/* Current Step Component */}
      <CurrentComponent
        userId={userId}
        onNext={handleStepNext}
        onSkip={handleStepSkip}
      />

      {/* Navigation */}
      {canGoPrevious && (
        <div className="step-navigation">
          <button
            onClick={goToPreviousStep}
            className="previous-button"
            disabled={isMarking}
          >
            ← Previous
          </button>
        </div>
      )}

      {isMarking && (
        <div className="completion-overlay">
          <div className="completion-message">
            <div className="spinner"></div>
            <p>Completing your profile...</p>
          </div>
        </div>
      )}
    </div>
  );
}
