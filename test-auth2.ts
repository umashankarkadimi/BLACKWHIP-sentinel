import { GoogleAuth } from 'google-auth-library';
const auth = new GoogleAuth({ scopes: 'https://www.googleapis.com/auth/cloud-platform' });
auth.getCredentials().then(console.log);
auth.getProjectId().then(console.log);
