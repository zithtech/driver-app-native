export const calculateCompletion = (user: any) => {
  if (!user) return 0;
  
  let totalScore = 0;

  // Helper to check if a document is uploaded/verified
  const isDocValid = (docKey: string, altKey: string) => {
    const doc = user.documents?.[docKey] || user.documents?.[altKey];
    return doc && (doc.status === 'verified' || doc.status === 'UPLOADED' || doc.status === 'PENDING' || doc.status === 'pending');
  };

  // 1. Personal Information (30%)
  if (user.first_name || user.full_name) totalScore += 10;
  if (user.phone_number) totalScore += 10;
  if (user.profile_picture || user.profile_pic_url || isDocValid('Profile_Selfie', 'profile_selfie')) totalScore += 10;

  // 2. Essential Documents (40%)
  if (isDocValid('Driving_License', 'driving_license')) totalScore += 10;
  if (isDocValid('Aadhar_Card', 'aadhaar_card') || isDocValid('Aadhaar_Card', 'aadhaar_card')) totalScore += 10;
  if (isDocValid('Pan_Card', 'pan_card')) totalScore += 10;
  if (isDocValid('Police_Verification', 'police_verification')) totalScore += 10;

  // 3. Address Details (15%)
  if (user.address && (user.address.street || user.address.city || user.address.pincode)) {
    totalScore += 15;
  }

  // 4. Additional & Emergency Information (15%)
  if (user.email) totalScore += 5;
  if (user.trusted_contact) totalScore += 5;
  if (user.alternate_contact) totalScore += 5;

  return Math.min(100, Math.round(totalScore));
};

export const getProfileMissingText = (user: any): string => {
  if (!user) return 'Complete your profile to get started.';

  const isDocValid = (docKey: string, altKey: string) => {
    const doc = user.documents?.[docKey] || user.documents?.[altKey];
    return doc && (doc.status === 'verified' || doc.status === 'UPLOADED' || doc.status === 'PENDING' || doc.status === 'pending');
  };

  if (!(user.first_name || user.full_name) || !user.phone_number) {
    return 'Add your personal information to continue.';
  }
  
  if (!(user.profile_picture || user.profile_pic_url || isDocValid('Profile_Selfie', 'profile_selfie'))) {
    return 'Upload a profile picture to complete your identity.';
  }

  if (!isDocValid('Driving_License', 'driving_license')) {
    return 'Upload your Driving License to start accepting rides.';
  }
  
  if (!(isDocValid('Aadhar_Card', 'aadhaar_card') || isDocValid('Aadhaar_Card', 'aadhaar_card'))) {
    return 'Upload your Aadhaar Card for identity verification.';
  }
  
  if (!isDocValid('Pan_Card', 'pan_card')) {
    return 'Add your PAN Card details for seamless payments.';
  }

  if (!isDocValid('Police_Verification', 'police_verification')) {
    return 'Upload your Police Verification for safety compliance.';
  }

  if (!user.trusted_contact) {
    return 'Add a trusted contact for emergencies.';
  }

  if (!(user.address && (user.address.street || user.address.city || user.address.pincode))) {
    return 'Add your address details for better support.';
  }

  return 'Your profile is fully updated!';
};
