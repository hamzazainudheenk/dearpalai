import axios from 'axios';

async function testAll() {
  console.log('--- 1. Testing Patient Login OTP ---');
  try {
    const res = await axios.post('http://localhost:3000/api/patient/login', {
      email: 'dearpal.clinic@gmail.com',
    });
    console.log('Patient login response:', res.status, res.data);
  } catch (err: any) {
    console.error('Patient login error:', err.response?.data || err.message);
  }

  console.log('\n--- 2. Testing Caretaker Send OTP ---');
  try {
    const res = await axios.post('http://localhost:3000/api/caretaker/otp/send', {
      mobile: '9778763290',
    });
    console.log('Caretaker OTP send response:', res.status, res.data);
  } catch (err: any) {
    console.error('Caretaker OTP send error:', err.response?.data || err.message);
  }
}

testAll();
