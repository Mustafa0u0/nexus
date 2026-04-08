const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

async function request(path, options = {}) {
    const res = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: { ...options.headers },
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || err.detail || 'Request failed');
    }
    return res.json();
}

export function registerUser(name, email, role) {
    const fd = new FormData();
    fd.append('name', name.trim());
    fd.append('email', email.trim().toLowerCase());
    fd.append('role', role);
    return request('/api/users/register', { method: 'POST', body: fd });
}

export function getUser(userId) {
    return request(`/api/users/${userId}`);
}

export function createJob(hrUserId, title, descriptionText) {
    const fd = new FormData();
    fd.append('hr_user_id', hrUserId);
    fd.append('title', title);
    fd.append('description_text', descriptionText);
    return request('/api/jobs', { method: 'POST', body: fd });
}

export function listJobs(status) {
    const qs = status ? `?status=${status}` : '';
    return request(`/api/jobs${qs}`);
}

export function getJob(jobId) {
    return request(`/api/jobs/${jobId}`);
}

export function applyForJob(jobId, employeeUserId, cvText, cvFile) {
    const fd = new FormData();
    fd.append('employee_user_id', employeeUserId);
    if (cvText) fd.append('cv_text', cvText);
    if (cvFile) fd.append('cv_file', cvFile);
    return request(`/api/jobs/${jobId}/apply`, { method: 'POST', body: fd });
}

export function getEmployeeApplications(userId) {
    return request(`/api/applications/employee/${userId}`);
}

export function getJobApplications(jobId) {
    return request(`/api/applications/job/${jobId}`);
}

export function getApplication(appId) {
    return request(`/api/applications/${appId}`);
}

export function inviteToInterview(appId) {
    return request(`/api/applications/${appId}/invite`, { method: 'POST' });
}

export function setupInterview(appId) {
    return request(`/api/interviews/${appId}/setup`, { method: 'POST' });
}

export function completeInterview(appId) {
    return request(`/api/interviews/${appId}/complete`, { method: 'POST' });
}

export function getInterviewState(appId) {
    return request(`/api/interviews/${appId}/state`);
}

export async function uploadVideo(appId, videoBlob) {
    const fd = new FormData();
    fd.append('file', videoBlob, 'interview.webm');
    return request(`/api/interviews/${appId}/video`, { method: 'POST', body: fd });
}

export function getInterviewReport(appId) {
    return request(`/api/interviews/${appId}/report`);
}

export function getVideoUrl(appId) {
    return `${API_URL}/api/interviews/${appId}/video`;
}

export function getInterviewVideoDownloadUrl(appId) {
    return `${API_URL}/api/interviews/${appId}/video/download`;
}

export function getInterviewTranscriptDownloadUrl(appId) {
    return `${API_URL}/api/interviews/${appId}/transcript/download`;
}

export function getInterviewAnalyticsDownloadUrl(appId) {
    return `${API_URL}/api/interviews/${appId}/analytics/download`;
}

export function getInterviewReportDownloadUrl(appId) {
    return `${API_URL}/api/interviews/${appId}/report/download`;
}

export function getInterviewAudioDownloadUrl(appId) {
    return `${API_URL}/api/interviews/${appId}/audio/download`;
}

export function getInterviewBundleDownloadUrl(appId) {
    return `${API_URL}/api/interviews/${appId}/bundle/download`;
}

// Original interview endpoints (used directly from interview page)
export function startInterview(sessionId) {
    const fd = new FormData();
    fd.append('session_id', sessionId);
    return fetch(`${API_URL}/start`, { method: 'POST', body: fd });
}

export function chatLoop(sessionId, audioBlob, eyeMetrics) {
    const fd = new FormData();
    fd.append('session_id', sessionId);
    fd.append('file', audioBlob, 'audio.webm');
    if (eyeMetrics) fd.append('eye_metrics', JSON.stringify(eyeMetrics));
    return fetch(`${API_URL}/chat`, { method: 'POST', body: fd });
}

export { API_URL };
