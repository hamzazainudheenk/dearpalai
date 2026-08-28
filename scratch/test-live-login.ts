import axios from 'axios';

async function testLogin() {
  try {
    const res = await axios.post('http://localhost:3000/api/patient/login', {
      email: 'dearpal.clinic@gmail.com',
    });
    console.log('Patient login response:', res.status, res.data);
  } catch (err: any) {
    console.error('Patient login failed:', err.response?.status, err.response?.data || err.message);
  }
}

testLogin();
