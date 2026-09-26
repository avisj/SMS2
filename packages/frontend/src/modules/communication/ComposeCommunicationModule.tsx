import React, { useEffect, useState } from 'react';
import {
  Send,
  Save,
  Clock,
  Eye,
  CheckCircle2,
  AlertCircle,
  Users,
  Layers,
  FileText,
  Calendar,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  BookmarkCheck,
  Building2,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { useWorkspace } from '../../context/WorkspaceContext.js';
import { api } from '../../api/client.js';
import {
  AcademicSession,
  ClassItem,
  SectionItem,
  CommunicationType,
  CommunicationPriority,
  AudienceType,
  CommunicationTemplate,
  User,
} from '../../types/index.js';
import { Card } from '../../components/common/Card.js';
import { Badge } from '../../components/common/Badge.js';
import { Button } from '../../components/common/Button.js';
import { Input } from '../../components/common/Input.js';
import { Select } from '../../components/common/Select.js';

interface ComposeCommunicationModuleProps {
  tabId?: string;
  onNavigate?: (moduleKey: string) => void;
  initialTemplateId?: string;
}

export const ComposeCommunicationModule: React.FC<ComposeCommunicationModuleProps> = ({
  onNavigate,
  initialTemplateId,
}) => {
  const { activeBranch, branches } = useAuth();
  const { openTab } = useWorkspace();

  // Wizard Step (1: Details, 2: Audience, 3: Message, 4: Delivery, 5: Preview)
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Form State
  const [draftId, setDraftId] = useState<string | null>(null);
  const [communicationType, setCommunicationType] = useState<CommunicationType>('NOTICE');
  const [title, setTitle] = useState<string>('');
  const [priority, setPriority] = useState<CommunicationPriority>('NORMAL');
  const [locationId, setLocationId] = useState<string>(activeBranch?.id || '');
  const [sessionId, setSessionId] = useState<string>('');
  
  // Audience State
  const [audienceType, setAudienceType] = useState<AudienceType>('ENTIRE_SCHOOL');
  const [classId, setClassId] = useState<string>('');
  const [sectionId, setSectionId] = useState<string>('');
  const [specificUserIds, setSpecificUserIds] = useState<string[]>([]);
  
  // Message & Delivery
  const [message, setMessage] = useState<string>('');
  const [requiresAck, setRequiresAck] = useState<boolean>(false);
  const [deliveryMode, setDeliveryMode] = useState<'NOW' | 'SCHEDULE'>('NOW');
  const [scheduledDateTime, setScheduledDateTime] = useState<string>('');

  // Dropdown Data
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [templates, setTemplates] = useState<CommunicationTemplate[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);

  // Audience Preview State
  const [previewTotal, setPreviewTotal] = useState<number>(0);
  const [previewSample, setPreviewSample] = useState<any[]>([]);
  const [previewLoading, setPreviewLoading] = useState<boolean>(false);

  // Status & Actions
  const [saving, setSaving] = useState<boolean>(false);
  const [publishing, setPublishing] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const navigateTo = (moduleKey: string, tabTitle: string, icon: string) => {
    if (onNavigate) {
      onNavigate(moduleKey);
    } else {
      openTab(moduleKey, tabTitle, icon);
    }
  };

  // Load Initial References
  useEffect(() => {
    const loadReferences = async () => {
      try {
        const [sessRes, classRes, secRes, templRes, usersRes] = await Promise.all([
          api.get<AcademicSession[]>('/academics/sessions'),
          api.get<ClassItem[]>('/academics/classes'),
          api.get<SectionItem[]>('/academics/sections'),
          api.get<CommunicationTemplate[]>('/communication/templates/list'),
          api.get<User[]>('/users', { pageSize: 50 }),
        ]);

        setSessions(sessRes || []);
        const activeSess = sessRes?.find((s) => s.status === 'ACTIVE') || sessRes?.[0];
        if (activeSess) setSessionId(activeSess.id);

        setClasses(classRes || []);
        setSections(secRes || []);
        setTemplates(templRes || []);
        setAllUsers(usersRes || []);

        if (initialTemplateId && templRes) {
          const matched = templRes.find(t => t.id === initialTemplateId);
          if (matched) {
            setTitle(matched.subject);
            setMessage(matched.message_body);
            setCommunicationType(matched.communication_type);
            setPriority(matched.priority);
            setRequiresAck(matched.requires_acknowledgement);
          }
        }
      } catch (err: any) {
        console.error('Error loading compose references:', err);
      }
    };
    loadReferences();
  }, [initialTemplateId]);

  // Sync Audience Preview whenever audience criteria changes
  const refreshAudiencePreview = async () => {
    setPreviewLoading(true);
    try {
      const res = await api.post<{ total: number; sample: any[]; audienceSummary: string }>(
        '/communication/preview-audience',
        {
          audience_type: audienceType,
          audience_filters: {
            location_id: locationId || undefined,
            academic_session_id: sessionId || undefined,
            class_id: classId || undefined,
            section_id: sectionId || undefined,
            user_ids: specificUserIds.length > 0 ? specificUserIds : undefined,
          },
        }
      );

      setPreviewTotal(res?.total || 0);
      setPreviewSample(res?.sample || []);
    } catch (err) {
      // quiet fallback
    } finally {
      setPreviewLoading(false);
    }
  };

  useEffect(() => {
    refreshAudiencePreview();
  }, [audienceType, classId, sectionId, locationId, sessionId, specificUserIds]);

  const handleApplyTemplate = (tmplId: string) => {
    const tmpl = templates.find((t) => t.id === tmplId);
    if (tmpl) {
      setTitle(tmpl.subject);
      setMessage(tmpl.message_body);
      setCommunicationType(tmpl.communication_type);
      setPriority(tmpl.priority);
      setRequiresAck(tmpl.requires_acknowledgement);
    }
  };

  const handleSaveDraft = async () => {
    if (!title.trim()) {
      setErrorMessage('Please enter a title for the draft.');
      return;
    }
    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const payload = {
        id: draftId || undefined,
        location_id: locationId || null,
        academic_session_id: sessionId || null,
        communication_type: communicationType,
        title: title.trim(),
        message: message.trim(),
        priority,
        audience_type: audienceType,
        audience_filters: {
          location_id: locationId || undefined,
          academic_session_id: sessionId || undefined,
          class_id: classId || undefined,
          section_id: sectionId || undefined,
          user_ids: specificUserIds,
        },
        requires_acknowledgement: requiresAck,
        delivery_channel: 'IN_APP',
      };

      const res = draftId
        ? await api.put<any>(`/communication/${draftId}/draft`, payload)
        : await api.post<any>('/communication/draft', payload);

      if (res?.id) {
        setDraftId(res.id);
      }
      setSuccessMessage('Draft saved successfully! You can resume editing anytime.');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save draft.');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!title.trim() || !message.trim()) {
      setErrorMessage('Both title and message body are required to publish.');
      return;
    }
    if (previewTotal === 0) {
      setErrorMessage('Cannot publish: no recipients match the selected audience criteria.');
      return;
    }

    setPublishing(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const payload = {
        id: draftId || undefined,
        location_id: locationId || null,
        academic_session_id: sessionId || null,
        communication_type: communicationType,
        title: title.trim(),
        message: message.trim(),
        priority,
        delivery_channel: 'IN_APP',
        audience_type: audienceType,
        audience_filters: {
          location_id: locationId || undefined,
          academic_session_id: sessionId || undefined,
          class_id: classId || undefined,
          section_id: sectionId || undefined,
          user_ids: specificUserIds,
        },
        requires_acknowledgement: requiresAck,
        scheduled_at: deliveryMode === 'SCHEDULE' && scheduledDateTime ? new Date(scheduledDateTime).toISOString() : null,
      };

      if (deliveryMode === 'SCHEDULE') {
        if (!scheduledDateTime) {
          throw new Error('Please select a scheduled date and time.');
        }
        await api.post('/communication/schedule', payload);
        setSuccessMessage('Communication successfully scheduled for delivery!');
      } else {
        const res = await api.post<{ communication: any; recipientCount: number }>('/communication/publish', payload);
        setSuccessMessage(`Successfully published! Delivered to ${res?.recipientCount || previewTotal} recipients.`);
      }

      // Reset form after short delay and navigate to History
      setTimeout(() => {
        navigateTo('communication_history', 'Communication History', 'Clock');
      }, 1500);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to publish communication.');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-brand-50 text-brand-700">
              <Send className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Compose School Notice</h1>
              <p className="text-xs text-slate-500">
                Draft, target, preview and send school communications with verifiable in-app delivery
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleSaveDraft}
            disabled={saving || publishing}
            icon={<Save className="w-4 h-4" />}
          >
            {saving ? 'Saving...' : 'Save Draft'}
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigateTo('communication_templates', 'Communication Templates', 'BookmarkCheck')}
            icon={<BookmarkCheck className="w-4 h-4" />}
          >
            Templates
          </Button>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span className="font-semibold">{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span className="font-semibold">{errorMessage}</span>
        </div>
      )}

      {/* Step Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white rounded-t-lg px-4 py-2">
        <div className="flex items-center gap-2 text-xs font-semibold">
          {[
            { num: 1, label: 'Details' },
            { num: 2, label: 'Audience' },
            { num: 3, label: 'Message' },
            { num: 4, label: 'Delivery' },
            { num: 5, label: 'Preview & Send' },
          ].map((s) => (
            <button
              key={s.num}
              onClick={() => setCurrentStep(s.num)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
                currentStep === s.num
                  ? 'bg-brand-600 text-brand-foreground shadow-2xs'
                  : currentStep > s.num
                  ? 'bg-brand-50 text-brand-700 hover:bg-brand-100'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full flex items-center justify-center text-2xs font-bold ${
                  currentStep === s.num ? 'bg-white text-brand-800' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {s.num}
              </span>
              <span>{s.label}</span>
            </button>
          ))}
        </div>

        <div className="text-2xs text-slate-500 font-medium">
          Audience Estimate:{' '}
          <span className="text-brand-700 font-bold">{previewTotal} recipients</span>
        </div>
      </div>

      {/* STEP 1: Details */}
      {currentStep === 1 && (
        <Card className="p-6 bg-white border-slate-200 space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-900">Step 1: Communication Details</h2>
            <p className="text-xs text-slate-500">Configure type, priority, and branch scope</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Communication Type *
              </label>
              <select
                value={communicationType}
                onChange={(e) => setCommunicationType(e.target.value as CommunicationType)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs bg-white text-slate-800 focus:ring-1 focus:ring-brand-500 focus:border-brand-500"
              >
                <option value="NOTICE">Official Notice</option>
                <option value="ANNOUNCEMENT">School Announcement</option>
                <option value="GENERAL_MESSAGE">General Message</option>
                <option value="ACADEMIC">Academic Circular</option>
                <option value="FEE">Fee Advisory</option>
                <option value="ATTENDANCE">Attendance Alert</option>
                <option value="EXAM">Examination Notice</option>
                <option value="EVENT">Event / Extracurricular</option>
                <option value="URGENT">Urgent Alert</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Priority Level *
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as CommunicationPriority)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs bg-white text-slate-800 focus:ring-1 focus:ring-brand-500 focus:border-brand-500"
              >
                <option value="NORMAL">Normal</option>
                <option value="HIGH">High Priority</option>
                <option value="URGENT">Urgent / Critical</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Branch / Campus Scope
              </label>
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs bg-white text-slate-800 focus:ring-1 focus:ring-brand-500 focus:border-brand-500"
              >
                <option value="">All Branches (School-wide)</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.location_name} ({b.location_code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Academic Session
              </label>
              <select
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs bg-white text-slate-800 focus:ring-1 focus:ring-brand-500 focus:border-brand-500"
              >
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.status === 'ACTIVE' ? '(Current)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Communication Title / Subject *
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Invitation to Upcoming Parent-Teacher Meeting (PTM)"
              className="text-xs"
            />
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <Button
              variant="primary"
              size="sm"
              onClick={() => setCurrentStep(2)}
              icon={<ArrowRight className="w-4 h-4" />}
            >
              Continue to Audience
            </Button>
          </div>
        </Card>
      )}

      {/* STEP 2: Audience */}
      {currentStep === 2 && (
        <Card className="p-6 bg-white border-slate-200 space-y-4">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Step 2: Audience Targeting</h2>
              <p className="text-xs text-slate-500">
                Audience is resolved dynamically from active enrollments and user relations
              </p>
            </div>
            <Badge variant="primary">
              {previewLoading ? 'Resolving...' : `${previewTotal} Recipients`}
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Target Audience Group *
              </label>
              <select
                value={audienceType}
                onChange={(e) => setAudienceType(e.target.value as AudienceType)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs bg-white text-slate-800 focus:ring-1 focus:ring-brand-500 focus:border-brand-500"
              >
                <option value="ENTIRE_SCHOOL">Entire School (All Users)</option>
                <option value="PARENTS">Parents / Guardians</option>
                <option value="STUDENTS">Students (Enrolled)</option>
                <option value="TEACHERS">Teaching Faculty</option>
                <option value="STAFF">All Staff & Faculty</option>
                <option value="CLASS">Specific Class</option>
                <option value="SECTION">Specific Section</option>
                <option value="SPECIFIC_USERS">Individual Specific Users</option>
              </select>
            </div>

            {/* Class / Section Filters */}
            {(audienceType === 'CLASS' || audienceType === 'SECTION' || audienceType === 'STUDENTS' || audienceType === 'PARENTS') && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Select Class
                  </label>
                  <select
                    value={classId}
                    onChange={(e) => setClassId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs bg-white text-slate-800 focus:ring-1 focus:ring-brand-500 focus:border-brand-500"
                  >
                    <option value="">All Classes</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Select Section
                  </label>
                  <select
                    value={sectionId}
                    onChange={(e) => setSectionId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs bg-white text-slate-800 focus:ring-1 focus:ring-brand-500 focus:border-brand-500"
                  >
                    <option value="">All Sections</option>
                    {sections.map((s) => (
                      <option key={s.id} value={s.id}>
                        Section {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {/* Specific Users Picker */}
            {audienceType === 'SPECIFIC_USERS' && (
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Select Specific Individuals
                </label>
                <select
                  multiple
                  value={specificUserIds}
                  onChange={(e) => {
                    const opts = Array.from(e.target.selectedOptions, (opt) => opt.value);
                    setSpecificUserIds(opts);
                  }}
                  className="w-full h-32 px-3 py-2 border border-slate-300 rounded-md text-xs bg-white text-slate-800 focus:ring-1 focus:ring-brand-500 focus:border-brand-500"
                >
                  {allUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.first_name} {u.last_name} ({u.email || u.username})
                    </option>
                  ))}
                </select>
                <p className="text-2xs text-slate-400 mt-1">Hold Ctrl/Cmd to select multiple users</p>
              </div>
            )}
          </div>

          {/* Audience Sample Preview */}
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-700">
                Resolved Recipients Preview (Sample of {previewTotal})
              </span>
              <button
                type="button"
                onClick={refreshAudiencePreview}
                className="text-2xs text-brand-700 hover:underline flex items-center gap-1 font-medium"
              >
                <RefreshCw className="w-3 h-3" /> Refresh Count
              </button>
            </div>

            {previewSample.length === 0 ? (
              <p className="text-xs text-slate-400 italic">
                No recipients match the selected criteria. Adjust class or filters.
              </p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {previewSample.map((s) => (
                  <div key={s.userId} className="p-2 rounded bg-white border border-slate-200 text-xs">
                    <div className="font-semibold text-slate-800">{s.name}</div>
                    <div className="text-2xs text-slate-500">{s.details || s.userType}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-between pt-4 border-t border-slate-100">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCurrentStep(1)}
              icon={<ArrowLeft className="w-4 h-4" />}
            >
              Back to Details
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={() => setCurrentStep(3)}
              icon={<ArrowRight className="w-4 h-4" />}
            >
              Continue to Message
            </Button>
          </div>
        </Card>
      )}

      {/* STEP 3: Message */}
      {currentStep === 3 && (
        <Card className="p-6 bg-white border-slate-200 space-y-4">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Step 3: Message Composition</h2>
              <p className="text-xs text-slate-500">Draft message or load from pre-built template</p>
            </div>

            {templates.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Template:</span>
                <select
                  onChange={(e) => handleApplyTemplate(e.target.value)}
                  className="px-2 py-1 text-xs border border-slate-300 rounded-md bg-white"
                  defaultValue=""
                >
                  <option value="" disabled>
                    -- Load Reusable Template --
                  </option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.template_name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Message Subject / Header *
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Subject..."
              className="text-xs font-semibold"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Message Body *
            </label>
            <textarea
              rows={8}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write the full communication message here..."
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs bg-white text-slate-800 focus:ring-1 focus:ring-brand-500 focus:border-brand-500 leading-relaxed"
            />
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-800">
                Acknowledgement Required
              </div>
              <div className="text-2xs text-slate-500">
                Require recipients to click an "Acknowledge" button upon reading this notice
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={requiresAck}
                onChange={(e) => setRequiresAck(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-600"></div>
            </label>
          </div>

          <div className="flex justify-between pt-4 border-t border-slate-100">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCurrentStep(2)}
              icon={<ArrowLeft className="w-4 h-4" />}
            >
              Back to Audience
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={() => setCurrentStep(4)}
              icon={<ArrowRight className="w-4 h-4" />}
            >
              Continue to Delivery
            </Button>
          </div>
        </Card>
      )}

      {/* STEP 4: Delivery */}
      {currentStep === 4 && (
        <Card className="p-6 bg-white border-slate-200 space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-900">Step 4: Delivery Options</h2>
            <p className="text-xs text-slate-500">Configure delivery channels and schedule</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">
                Delivery Mode
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setDeliveryMode('NOW')}
                  className={`p-4 rounded-lg border text-left transition-all ${
                    deliveryMode === 'NOW'
                      ? 'border-brand-600 bg-brand-50/50 shadow-2xs'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Send className={`w-4 h-4 ${deliveryMode === 'NOW' ? 'text-brand-700' : 'text-slate-400'}`} />
                    <span className="text-xs font-bold text-slate-900">Send Immediately</span>
                  </div>
                  <p className="text-2xs text-slate-500 mt-1">
                    Publish notice and deliver to recipient inboxes instantly
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setDeliveryMode('SCHEDULE')}
                  className={`p-4 rounded-lg border text-left transition-all ${
                    deliveryMode === 'SCHEDULE'
                      ? 'border-brand-600 bg-brand-50/50 shadow-2xs'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Clock className={`w-4 h-4 ${deliveryMode === 'SCHEDULE' ? 'text-brand-700' : 'text-slate-400'}`} />
                    <span className="text-xs font-bold text-slate-900">Schedule for Later</span>
                  </div>
                  <p className="text-2xs text-slate-500 mt-1">
                    Specify future date and time for automated transmission
                  </p>
                </button>
              </div>
            </div>

            {deliveryMode === 'SCHEDULE' && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
                <label className="block text-xs font-semibold text-blue-900">
                  Select Delivery Date & Time (Asia/Kolkata IST) *
                </label>
                <input
                  type="datetime-local"
                  value={scheduledDateTime}
                  onChange={(e) => setScheduledDateTime(e.target.value)}
                  className="px-3 py-2 border border-blue-300 rounded-md text-xs bg-white text-slate-800"
                />
                <p className="text-2xs text-blue-700">
                  Scheduling is persisted in Supabase with standard timestamp conversion.
                </p>
              </div>
            )}

            {/* Channels Showcase */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">
                Available Delivery Channels
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg border border-brand-500 bg-brand-50 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-brand-600" />
                  <div>
                    <div className="text-xs font-bold text-brand-900">IN_APP</div>
                    <div className="text-2xs text-brand-700 font-semibold">Working Demo Active</div>
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 opacity-65">
                  <div className="text-xs font-bold text-slate-700">EMAIL</div>
                  <div className="text-2xs text-slate-400">Coming Soon / Not Configured</div>
                </div>

                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 opacity-65">
                  <div className="text-xs font-bold text-slate-700">SMS GATEWAY</div>
                  <div className="text-2xs text-slate-400">Coming Soon / Not Configured</div>
                </div>

                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 opacity-65">
                  <div className="text-xs font-bold text-slate-700">WHATSAPP</div>
                  <div className="text-2xs text-slate-400">Coming Soon / Not Configured</div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-between pt-4 border-t border-slate-100">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCurrentStep(3)}
              icon={<ArrowLeft className="w-4 h-4" />}
            >
              Back to Message
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={() => setCurrentStep(5)}
              icon={<ArrowRight className="w-4 h-4" />}
            >
              Review Preview
            </Button>
          </div>
        </Card>
      )}

      {/* STEP 5: Preview & Final Send */}
      {currentStep === 5 && (
        <Card className="p-6 bg-white border-slate-200 space-y-6">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Step 5: Preview & Publish Confirmation</h2>
              <p className="text-xs text-slate-500">
                Verify communication exactly as recipients will receive it before publishing
              </p>
            </div>
            <Badge variant="primary">{previewTotal} Recipients</Badge>
          </div>

          {/* Recipient's Visual Card Preview */}
          <div className="max-w-2xl mx-auto border-2 border-slate-200 rounded-xl p-5 bg-slate-50/50 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <Badge variant={priority === 'URGENT' ? 'rose' : priority === 'HIGH' ? 'amber' : 'indigo'}>
                  {communicationType}
                </Badge>
                {priority !== 'NORMAL' && (
                  <Badge variant="rose">{priority}</Badge>
                )}
              </div>
              <div className="text-2xs text-slate-400">
                {deliveryMode === 'NOW' ? 'Ready to Send' : `Scheduled: ${scheduledDateTime}`}
              </div>
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900">{title || 'Untitled Notice'}</h3>
              <p className="text-xs text-slate-700 whitespace-pre-line mt-2 leading-relaxed bg-white p-4 rounded-lg border border-slate-200">
                {message || 'No message content entered.'}
              </p>
            </div>

            {requiresAck && (
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg flex items-center justify-between">
                <span className="text-xs text-purple-900 font-semibold">
                  Recipient Acknowledgement Required
                </span>
                <span className="text-2xs px-2 py-0.5 rounded bg-purple-200 text-purple-800 font-bold">
                  Action Pending
                </span>
              </div>
            )}

            <div className="text-2xs text-slate-400 border-t border-slate-200 pt-2 flex justify-between">
              <span>Target: {audienceType.replace('_', ' ')}</span>
              <span>Channel: In-App Message Center</span>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex justify-between pt-4 border-t border-slate-100">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCurrentStep(4)}
              icon={<ArrowLeft className="w-4 h-4" />}
            >
              Back to Delivery
            </Button>

            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleSaveDraft}
                disabled={saving || publishing}
                icon={<Save className="w-4 h-4" />}
              >
                Save Draft
              </Button>

              <Button
                variant="primary"
                size="sm"
                onClick={handlePublish}
                disabled={saving || publishing}
                icon={<Send className="w-4 h-4" />}
              >
                {publishing
                  ? 'Processing...'
                  : deliveryMode === 'SCHEDULE'
                  ? 'Schedule Communication'
                  : 'Publish & Send Now'}
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
