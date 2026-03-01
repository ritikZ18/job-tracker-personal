import {
    scoreJobCandidateLink,
    isJunkListingTitle,
    isValidJobPostingPage,
    detectRemote,
    detectSeniority,
    detectEmploymentType,
    ExtractedData
} from '../lib/parser.js';

async function runTests() {
    console.log('🚀 Starting Phase 10 Verification Tests...\n');

    let passed = 0;
    let failed = 0;

    function assert(condition: boolean, message: string) {
        if (condition) {
            console.log(` ✅ PASS: ${message}`);
            passed++;
        } else {
            console.error(` ❌ FAIL: ${message}`);
            failed++;
        }
    }

    // --- 1. Link Scoring ---
    console.log('\n--- 1. Link Scoring Tests ---');
    assert(scoreJobCandidateLink('/careers/software-engineer', 'Software Engineer') > 2, 'Valid job link gets high score');
    assert(scoreJobCandidateLink('/jobs/12345', 'Staff Product Manager') > 2, 'Pattern-based job link gets high score');
    assert(scoreJobCandidateLink('https://www.amazon.jobs/en/jobs/2874108/sde', 'SDE') > 2, 'Amazon job link gets high score (path match)');
    assert(scoreJobCandidateLink('https://www.amazon.jobs/en/applicant/dashboard', 'Dashboard') < 0, 'Amazon dashboard gets negative score (domain ignored)');
    assert(scoreJobCandidateLink('/privacy-policy', 'Privacy Policy') < 0, 'Privacy policy gets negative score');
    assert(scoreJobCandidateLink('/about-us', 'About Our Culture') < 0, 'About page gets negative score');

    // --- 2. Junk Title Detection ---
    console.log('\n--- 2. Junk Title Detection Tests ---');
    assert(isJunkListingTitle('Privacy Policy') === true, 'Privacy Policy is junk');
    assert(isJunkListingTitle('Join our Talent Network') === true, 'Talent Network is junk');
    assert(isJunkListingTitle('Software Engineer') === false, 'Real job title is NOT junk');
    assert(isJunkListingTitle('Director of Engineering') === false, 'Senior title is NOT junk');

    // --- 3. Remote/Seniority/Employment Detect ---
    console.log('\n--- 3. Heuristics Detection Tests ---');
    assert(detectRemote('Software Engineer (Remote)') === true, 'Detects remote in title');
    assert(detectRemote('Frontend Dev', 'Work From Home') === true, 'Detects remote in location');
    assert(detectSeniority('Senior Software Engineer') === 'Senior', 'Detects Senior');
    assert(detectSeniority('Junior Frontend Developer') === 'Junior', 'Detects Junior');
    assert(detectSeniority('Staff Engineer') === 'Staff', 'Detects Staff');
    assert(detectEmploymentType('Intern - Backend') === 'Intern', 'Detects Intern');
    assert(detectEmploymentType('Contractor - DevOps') === 'Contract', 'Detects Contract');

    // --- 4. Validation Gate ---
    console.log('\n--- 4. Validation Gate Tests ---');
    const validJob: ExtractedData = {
        title: 'Senior DevOps Engineer',
        description: 'We are looking for a DevOps engineer with 5+ years of experience. You will work with AWS, Terraform, and Kubernetes. This is a full-time role... '.repeat(5),
        company: 'CloudCorp',
        jobId: 'devops-123'
    };
    assert(isValidJobPostingPage(validJob) === true, 'Valid job page passes gate');

    const junkPage: ExtractedData = {
        title: 'Privacy Policy',
        description: 'This privacy policy explains how we collect and use your data. We take your privacy seriously... '.repeat(10),
        company: 'CloudCorp'
    };
    assert(isValidJobPostingPage(junkPage) === false, 'Junk page (Privacy) fails gate');

    const thinPage: ExtractedData = {
        title: 'Software Engineer',
        description: 'Apply here.',
        company: 'CloudCorp'
    };
    assert(isValidJobPostingPage(thinPage) === false, 'Thin content fails gate');

    console.log(`\n\n📊 RESULTS: ${passed} Passed, ${failed} Failed`);
    if (failed > 0) process.exit(1);
    console.log('✨ All tests passed!');
}

runTests().catch(err => {
    console.error('Test execution failed:', err);
    process.exit(1);
});
