import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import JoinPage from './pages/JoinPage';
import VotingRoom from './pages/VotingRoom';
import ResultsPage from './pages/ResultsPage';
import AdminDashboard from './pages/admin/AdminDashboard';
import CreateSession from './pages/admin/CreateSession';
import SessionManager from './pages/admin/SessionManager';
import NotFoundPage from './pages/NotFoundPage';

export default function App() {
  return (
    <Routes>
      <Route path="/join/:code" element={<JoinPage />} />
      <Route path="/vote/:slug" element={<VotingRoom />} />
      <Route path="/vote/:slug/results" element={<ResultsPage />} />
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="/admin/sessions/new" element={<CreateSession />} />
      <Route path="/admin/sessions/:id" element={<SessionManager />} />
      <Route path="/" element={<Navigate to="/admin" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
