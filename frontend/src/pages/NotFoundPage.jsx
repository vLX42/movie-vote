import React from 'react';
import { Link } from 'react-router-dom';
import './NotFoundPage.css';

export default function NotFoundPage() {
  return (
    <div className="notfound-page page-centered">
      <div className="notfound-content">
        <div className="notfound-tape">▶▶▶</div>
        <h1 className="title-huge">404</h1>
        <p className="notfound-sub label-mono">This tape doesn't exist.</p>
        <Link to="/admin" className="btn btn-secondary mt-3">
          Back to Admin
        </Link>
      </div>
    </div>
  );
}
