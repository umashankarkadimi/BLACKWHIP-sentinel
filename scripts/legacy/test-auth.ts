import { GoogleAuth } from 'google-auth-library';
const auth = new GoogleAuth({ scopes: 'https://www.googleapis.com/auth/cloud-platform' });
auth.getClient().then(c => c.request({url: 'https://www.googleapis.com/oauth2/v1/userinfo'})).then(r => console.log(r.data)).catch(e => console.error(e.message));
