import axios from 'axios';

async function testTodoBackend() {
  console.log('--- Testing Patient To-Do Backend Endpoints ---');
  // Login first to get patient token
  const loginRes = await axios.post('http://localhost:3000/api/patient/login', {
    email: 'dearpal.clinic@gmail.com',
  });
  console.log('Login initiated:', loginRes.data);

  // We can query with mock auth or test todo service directly
}

testTodoBackend().catch(console.error);
