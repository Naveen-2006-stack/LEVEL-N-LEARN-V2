import { quizController } from '../src/controllers/quizController.js';
import { quizService } from '../src/services/quizService.js';
import { supabase } from '../src/config/supabase.js';
import { verifyAuthToken } from '../src/utils/cryptoUtils.js';

function createMockReply() {
  return {
    statusCode: 200,
    payload: null,
    code(c) { this.statusCode = c; return this; },
    send(p) { this.payload = p; return this; }
  };
}

async function testSuite() {
  console.log('=== LEVELNLEARN AUTHENTICATION VERIFICATION SUITE ===');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  const testEmailA = 'testuser_alpha@srmist.edu.in';
  const testPassA = 'AlphaPass@123';
  const testEmailB = 'testuser_beta@srmist.edu.in';
  const testPassB = 'BetaPass@456';

  // Clean up any test users before running
  await supabase.from('users').delete().eq('email', testEmailA);
  await supabase.from('users').delete().eq('email', testEmailB);
  await supabase.from('users').delete().eq('username', 'testuser_alpha');
  await supabase.from('users').delete().eq('username', 'testuser_beta');

  console.log('\n--- Scenario 1: Register New Account & Login ---');
  let reply = createMockReply();
  await quizController.srmistRegister({
    body: { fullName: 'Alpha User', email: testEmailA, password: testPassA }
  }, reply);
  assert(reply.statusCode === 201 && reply.payload?.success, 'Registration returns 201 Created');

  // Verify saved in Supabase
  const { data: dbUserA } = await supabase.from('users').select('*').eq('email', testEmailA).single();
  assert(dbUserA && dbUserA.password_hash && dbUserA.salt, 'User persisted in Supabase with password hash and salt');

  // Login
  reply = createMockReply();
  await quizController.srmistLogin({
    body: { email: testEmailA, password: testPassA }
  }, reply);
  assert(reply.statusCode === 200 && reply.payload?.data?.token, 'Login succeeds with valid credentials and returns JWT');
  const tokenPayload = verifyAuthToken(reply.payload?.data?.token);
  assert(tokenPayload && tokenPayload.userId === dbUserA.id, 'Issued token maps to correct user ID');

  console.log('\n--- Scenario 2: Logout & Login Again ---');
  reply = createMockReply();
  await quizController.srmistLogin({
    body: { email: testEmailA, password: testPassA }
  }, reply);
  assert(reply.statusCode === 200 && reply.payload?.success, 'Subsequent login succeeds without re-registration');

  console.log('\n--- Scenario 3: Duplicate Registration Protection ---');
  reply = createMockReply();
  await quizController.srmistRegister({
    body: { fullName: 'Alpha Imposter', email: testEmailA, password: 'NewPassword@999' }
  }, reply);
  assert(reply.statusCode === 409, 'Duplicate registration is rejected with HTTP 409 Conflict');
  assert(reply.payload?.error?.includes('already exists'), 'Appropriate duplicate error message returned');

  // Verify original password hash was NOT overwritten
  const { data: dbUserACheck } = await supabase.from('users').select('*').eq('email', testEmailA).single();
  assert(dbUserACheck.password_hash === dbUserA.password_hash, 'Original password hash was preserved and not overwritten');

  console.log('\n--- Scenario 4: Wrong Password Rejection ---');
  reply = createMockReply();
  await quizController.srmistLogin({
    body: { email: testEmailA, password: 'WrongPassword@123' }
  }, reply);
  assert(reply.statusCode === 401, 'Wrong password rejected with HTTP 401');

  console.log('\n--- Scenario 5: Nonexistent User Rejection ---');
  reply = createMockReply();
  await quizController.srmistLogin({
    body: { email: 'nonexistent_ghost_999@srmist.edu.in', password: 'AnyPassword@123' }
  }, reply);
  assert(reply.statusCode === 401, 'Nonexistent email rejected with HTTP 401');

  console.log('\n--- Scenario 6: Email Case Normalization ---');
  reply = createMockReply();
  await quizController.srmistLogin({
    body: { email: 'TESTUSER_ALPHA@SRMIST.EDU.IN', password: testPassA }
  }, reply);
  assert(reply.statusCode === 200 && reply.payload?.success, 'Uppercase email successfully normalized and logs in');

  console.log('\n--- Scenario 7: Email Accidental Whitespace Normalization ---');
  reply = createMockReply();
  await quizController.srmistLogin({
    body: { email: '  testuser_alpha@srmist.edu.in   ', password: testPassA }
  }, reply);
  assert(reply.statusCode === 200 && reply.payload?.success, 'Email with leading/trailing spaces normalized and logs in');

  console.log('\n--- Scenario 8: Existing Uncredentialed User Registration (The Original Bug) ---');
  // Simulate an uncredentialed row in DB (e.g. from guest play or legacy stub)
  const stubNetId = 'stubplayer_' + Math.floor(Math.random() * 10000);
  const stubEmail = `${stubNetId}@srmist.edu.in`;
  const { data: stubUser } = await supabase.from('users').insert([{
    id: crypto.randomUUID(),
    username: stubNetId,
    email: null, // Legacy null email
    full_name: null,
    password_hash: null,
    salt: null,
    role: 'user',
    is_verified: true,
  }]).select().single();

  assert(stubUser && !stubUser.password_hash, 'Pre-existing stub user created in database with null email and hash');

  // Now the student registers their account
  reply = createMockReply();
  await quizController.srmistRegister({
    body: { fullName: 'Stub Player', email: stubEmail, password: 'StubPassword@123' }
  }, reply);
  assert(reply.statusCode === 201, 'First registration for pre-existing username succeeds with 201');

  // Verify the SAME user ID was updated in DB with password_hash and email
  const { data: activatedStub } = await supabase.from('users').select('*').eq('id', stubUser.id).single();
  assert(activatedStub.email === stubEmail, 'Stub user record updated with canonical email');
  assert(activatedStub.password_hash !== null, 'Stub user record updated with password hash in database');
  assert(activatedStub.id === stubUser.id, 'User ID preserved across registration');

  // Login immediately with credentials
  reply = createMockReply();
  await quizController.srmistLogin({
    body: { email: stubEmail, password: 'StubPassword@123' }
  }, reply);
  assert(reply.statusCode === 200 && reply.payload?.success, 'FIRST login immediately succeeds without re-registering');

  // Re-registration MUST be rejected
  reply = createMockReply();
  await quizController.srmistRegister({
    body: { fullName: 'Stub Player Again', email: stubEmail, password: 'StubPassword@123' }
  }, reply);
  assert(reply.statusCode === 409, 'Re-registration of activated account rejected with 409');

  console.log('\n--- Scenario 9: Two-User Isolation ---');
  reply = createMockReply();
  await quizController.srmistRegister({
    body: { fullName: 'Beta User', email: testEmailB, password: testPassB }
  }, reply);
  assert(reply.statusCode === 201, 'User Beta registers successfully');

  reply = createMockReply();
  await quizController.srmistLogin({ body: { email: testEmailB, password: testPassB } }, reply);
  const tokenB = reply.payload?.data?.token;
  const decodedB = verifyAuthToken(tokenB);

  reply = createMockReply();
  await quizController.srmistLogin({ body: { email: testEmailA, password: testPassA } }, reply);
  const tokenA = reply.payload?.data?.token;
  const decodedA = verifyAuthToken(tokenA);

  assert(decodedA.userId !== decodedB.userId, 'User A and User B have completely distinct IDs');
  assert(decodedA.username === 'testuser_alpha' && decodedB.username === 'testuser_beta', 'User A and B usernames isolated');

  // Cross-credential check: User A password with User B email
  reply = createMockReply();
  await quizController.srmistLogin({ body: { email: testEmailB, password: testPassA } }, reply);
  assert(reply.statusCode === 401, 'User A credentials rejected when attempting to login as User B');

  console.log('\n--- Scenario 10: Test Domain (example.com) Support ---');
  const exampleEmail = 'test-levelnlearn@example.com';
  await supabase.from('users').delete().eq('email', exampleEmail);
  await supabase.from('users').delete().eq('username', 'test-levelnlearn');

  reply = createMockReply();
  await quizController.srmistRegister({
    body: { fullName: 'Test LLN', email: exampleEmail, password: 'TestPassword@123' }
  }, reply);
  assert(reply.statusCode === 201, 'Registration with test-levelnlearn@example.com succeeds with 201');

  reply = createMockReply();
  await quizController.srmistLogin({
    body: { email: exampleEmail, password: 'TestPassword@123' }
  }, reply);
  assert(reply.statusCode === 200 && reply.payload?.success, 'Login with test-levelnlearn@example.com succeeds on first attempt');

  // Clean up all test fixtures
  await supabase.from('users').delete().eq('email', testEmailA);
  await supabase.from('users').delete().eq('email', testEmailB);
  await supabase.from('users').delete().eq('email', stubEmail);
  await supabase.from('users').delete().eq('email', exampleEmail);

  console.log(`\n========================================`);
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

testSuite().catch(err => {
  console.error('Test Suite Error:', err);
  process.exit(1);
});
