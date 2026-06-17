import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Platform, Image, useWindowDimensions } from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';

const DragAndDropZone = ({ label, fileName, onFileDrop, isImage = false }) => {
  const [dragging, setDragging] = useState(false);
  
  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    if (Platform.OS === 'web' && e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      onFileDrop(file.name);
    }
  };

  const handleSelectFile = (e) => {
    if (Platform.OS === 'web' && e.target.files && e.target.files.length > 0) {
      onFileDrop(e.target.files[0].name);
    }
  };

  return (
    <View 
      style={[
        styles.uploadZone, 
        dragging && styles.uploadZoneDragging,
        fileName ? styles.uploadZoneSuccess : null
      ]}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <Text style={styles.uploadIcon}>{isImage ? '📷' : '📄'}</Text>
      {fileName ? (
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.uploadFileName}>📎 {fileName}  ✅ Uploaded</Text>
          <Text style={styles.uploadHint}>Drag another file here or click to replace</Text>
        </View>
      ) : (
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.uploadHint}>Drag and drop your file here, or click to browse</Text>
        </View>
      )}
      {Platform.OS === 'web' && (
        <input
          type="file"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            opacity: 0,
            cursor: 'pointer',
            width: '100%',
            height: '100%'
          }}
          onChange={handleSelectFile}
          accept={isImage ? "image/*" : ".pdf,.doc,.docx"}
        />
      )}
    </View>
  );
};

export default function TelemedicineDoctorApplicationScreen({ 
  onNavigate, 
  currentUser, 
  sessionToken, 
  onLoginSuccess,
  subsystemData,
  siteSettings 
}) {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const [step, setStep] = useState(1); // 1 | 2 | 3
  
  // Step 1: Personal Info & Specialization Selection
  const [title, setTitle] = useState('Dr.');
  const [fullName, setFullName] = useState(
    (currentUser?.first_name || currentUser?.last_name)
      ? `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim()
      : ""
  );
  const [email, setEmail] = useState(currentUser?.email || '');
  const [phone, setPhone] = useState(currentUser?.phone_number || '');
  
  const [searchQuery, setSearchQuery] = useState('');
  
  // Specializations state from DB
  const [dbSpecializations, setDbSpecializations] = useState([]);
  const [selectedSpecs, setSelectedSpecs] = useState({});
  const [loadingSpecs, setLoadingSpecs] = useState(true);

  const [customSpecs, setCustomSpecs] = useState([]);
  const [newSpecName, setNewSpecName] = useState('');
  const [showAddCustom, setShowAddCustom] = useState(false);

  // Step 2: License & Credentials
  const [licenseNumber, setLicenseNumber] = useState('');
  const [licensingBoard, setLicensingBoard] = useState('');
  const [gradYear, setGradYear] = useState('');
  
  // Drag and Drop Uploads
  const [fileName, setFileName] = useState(''); // Medical License Document
  const [mdcnCertFileName, setMdcnCertFileName] = useState(''); // MDCN Certificate
  const [idDocFileName, setIdDocFileName] = useState(''); // ID Document
  const [cvFileName, setCvFileName] = useState(''); // CV/Resume
  const [profilePhotoName, setProfilePhotoName] = useState(''); // Profile Photo

  // Qualifications list and temp inputs
  const [qualifications, setQualifications] = useState([]);
  const [qualDegree, setQualDegree] = useState('');
  const [qualInstitution, setQualInstitution] = useState('');
  const [qualYear, setQualYear] = useState('');
  const [qualCertFileName, setQualCertFileName] = useState('');

  // Experience list and temp inputs
  const [experiences, setExperiences] = useState([]);
  const [expHospital, setExpHospital] = useState('');
  const [expPosition, setExpPosition] = useState('');
  const [expFrom, setExpFrom] = useState('');
  const [expTo, setExpTo] = useState('');

  // Step 3: Consultation Pricing & Wallet Settings
  const [consultationFee, setConsultationFee] = useState('');
  const [liveStreamFee, setLiveStreamFee] = useState('');
  const [acceptPoints, setAcceptPoints] = useState(false);
  const [schedule, setSchedule] = useState({
    Monday: { enabled: false, fromTime: '', toTime: '' },
    Tuesday: { enabled: false, fromTime: '', toTime: '' },
    Wednesday: { enabled: false, fromTime: '', toTime: '' },
    Thursday: { enabled: false, fromTime: '', toTime: '' },
    Friday: { enabled: false, fromTime: '', toTime: '' },
    Saturday: { enabled: false, fromTime: '', toTime: '' },
    Sunday: { enabled: false, fromTime: '', toTime: '' }
  });
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [bio, setBio] = useState('');

  const handleCopyToWeekdays = () => {
    const mon = schedule.Monday;
    setSchedule(prev => ({
      ...prev,
      Tuesday: { ...mon },
      Wednesday: { ...mon },
      Thursday: { ...mon },
      Friday: { ...mon }
    }));
  };

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Pull brand assets from database
  const portalName = subsystemData?.name || 'Telemedicine Hub';
  const portalSubtitle = subsystemData?.settings?.badge || '24/7 Virtual Consultation';
  const doctorImage = subsystemData?.settings?.imageUrl || 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=1000&auto=format&fit=crop&q=80';
  const portalDesc = subsystemData?.description || 'Skip the waiting rooms. Connect with a verified doctor in minutes right from your home or office. Secure, private, and convenient.';

  // Load specializations from database on mount
  useEffect(() => {
    const fetchSpecs = async () => {
      try {
        setLoadingSpecs(true);
        const res = await fetch(`${API_URL}/api/medical-specializations?limit=100`);
        const json = await res.json();
        if (json.success && json.data) {
          const list = json.data.specializations || json.data || [];
          setDbSpecializations(list);
          
          // Initialize selected specializations as empty
          setSelectedSpecs({});
        }
      } catch (err) {
        console.error('Failed to fetch specializations:', err);
      } finally {
        setLoadingSpecs(false);
      }
    };
    fetchSpecs();
  }, []);

  const handleAddCustomSpec = () => {
    if (newSpecName.trim()) {
      setCustomSpecs([...customSpecs, { name: newSpecName.trim(), years: '2', checked: true }]);
      setNewSpecName('');
      setShowAddCustom(false);
    }
  };

  const handleNextStep = () => {
    setErrorMsg('');
    if (step === 1) {
      if (!fullName.trim() || !phone.trim()) {
        setErrorMsg('Please complete your name and phone details.');
        return;
      }
      const hasAnySelected = Object.values(selectedSpecs).some(s => s.checked) || customSpecs.some(s => s.checked);
      if (!hasAnySelected) {
        setErrorMsg('Please select at least one medical specialization.');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!licenseNumber.trim() || !licensingBoard.trim() || !gradYear.trim()) {
        setErrorMsg('Please complete your licensing credentials.');
        return;
      }
      if (!fileName || !mdcnCertFileName || !idDocFileName || !cvFileName || !profilePhotoName) {
        setErrorMsg('Please upload all 5 required documents & photo in License & Certificates section.');
        return;
      }
      setStep(3);
    }
  };

  const handleAddQualification = () => {
    if (qualDegree.trim() && qualInstitution.trim() && qualYear.trim()) {
      setQualifications([...qualifications, {
        degree: qualDegree.trim(),
        institution: qualInstitution.trim(),
        year: qualYear.trim(),
        certificate: qualCertFileName || 'certificate.pdf'
      }]);
      setQualDegree('');
      setQualInstitution('');
      setQualYear('');
      setQualCertFileName('');
    } else {
      setErrorMsg('Please complete Degree, Institution, and Year to add a qualification.');
    }
  };

  const handleAddExperience = () => {
    if (expHospital.trim() && expPosition.trim() && expFrom.trim() && expTo.trim()) {
      setExperiences([...experiences, {
        hospital: expHospital.trim(),
        position: expPosition.trim(),
        from: expFrom.trim(),
        to: expTo.trim()
      }]);
      setExpHospital('');
      setExpPosition('');
      setExpFrom('');
      setExpTo('');
    } else {
      setErrorMsg('Please complete Hospital, Position, and From/To years to add experience.');
    }
  };

  const handleBackStep = () => {
    setErrorMsg('');
    if (step > 1) {
      setStep(step - 1);
    } else {
      onNavigate('dashboard');
    }
  };

  const handleSubmitApplication = async () => {
    if (!consultationFee.trim() || !accountNumber.trim() || !bio.trim()) {
      setErrorMsg('Please complete all consultation and payout details.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    // Gather selected specializations
    const specs = [];
    Object.keys(selectedSpecs).forEach(specId => {
      const item = selectedSpecs[specId];
      if (item.checked) {
        const dbSpec = dbSpecializations.find(s => String(s.specialization_id) === String(specId));
        if (dbSpec) {
          specs.push({
            name: dbSpec.specialization_name,
            years: item.years,
            primary: item.primary || false,
            sub_specialties: item.sub_specialties || []
          });
        }
      }
    });
    customSpecs.forEach(s => {
      if (s.checked) {
        specs.push({
          name: s.name,
          years: s.years
        });
      }
    });

    try {
      const response = await fetch(`${API_URL}/api/auth/complete-profile`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          display_name: `${title} ${fullName}`.trim(),
          preferences: {
            user_type: 'doctor',
            doctor_profile: {
              title,
              phone: phone.trim(),
              specializations: specs,
              license: {
                license_number: licenseNumber.trim(),
                board: licensingBoard.trim(),
                grad_year: gradYear.trim(),
                uploaded_file: fileName,
                mdcn_certificate: mdcnCertFileName,
                id_document: idDocFileName,
                cv_resume: cvFileName,
                profile_photo: profilePhotoName
              },
              qualifications: qualifications,
              experience: experiences,
              consultation_fee: consultationFee.trim(),
              live_stream_fee: liveStreamFee.trim(),
              accept_points: acceptPoints,
              availability_schedule: schedule,
              payout: {
                bank: bankName,
                account: accountNumber.trim()
              },
              bio: bio.trim()
            }
          }
        })
      });

      const json = await response.json();
      if (json.success) {
        if (Platform.OS === 'web' && typeof window !== 'undefined' && window.showToast) {
          window.showToast('Application Submitted! ⚕️', 'Your doctor profile has been successfully submitted for verification.', 'success');
        }
        onLoginSuccess(sessionToken, json.data.user);
      } else {
        setErrorMsg(json.message || 'Failed to submit application.');
      }
    } catch (err) {
      setErrorMsg('Connection error. Failed to send application.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const renderFormCard = () => (
    <View style={isMobile ? styles.card : styles.glassCardDesktop} className="telemed-card">
      {/* Header Row */}
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={handleBackStep} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Become a Doctor</Text>
        <Text style={styles.stepIndicator}>Step {step} of 3</Text>
      </View>

      {errorMsg ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>❌ {errorMsg}</Text>
        </View>
      ) : null}

      {/* STEP 1: Specialization Selection */}
      {step === 1 && (
        <View style={{ width: '100%' }}>
          {/* Section 1: Personal Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📝 Personal Information</Text>
            
            <View style={styles.inputRow}>
              <View style={[styles.inputGroup, { width: 90 }]}>
                <Text style={styles.label}>Title</Text>
                <TextInput
                  style={styles.input}
                  className="doctor-input"
                  value={title}
                  onChangeText={setTitle}
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>Full Name</Text>
                <TextInput
                  style={styles.input}
                  className="doctor-input"
                  value={fullName}
                  onChangeText={setFullName}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email Address</Text>
              <TextInput
                style={[styles.input, styles.inputDisabled]}
                value={email}
                editable={false}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Phone Number</Text>
              <TextInput
                style={styles.input}
                className="doctor-input"
                value={phone}
                onChangeText={setPhone}
              />
            </View>
          </View>

          {/* Section 2: Specialization Selector */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🩺 Select Your Specialization(s)</Text>
            
            {/* Search Bar */}
            <View style={[styles.inputGroup, { marginBottom: 16 }]}>
              <TextInput
                style={styles.input}
                className="doctor-input"
                placeholder="🔍 Search specializations..."
                placeholderTextColor="#827E8C"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            {loadingSpecs ? (
              <ActivityIndicator size="small" color="#00d2ff" style={{ marginVertical: 20 }} />
            ) : (
              <>
                {dbSpecializations
                  .filter(spec => spec.specialization_name.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map(spec => {
                    const specId = spec.specialization_id;
                    const isChecked = !!selectedSpecs[specId]?.checked;
                    const years = selectedSpecs[specId]?.years || '5';
                    const isCardiology = spec.specialization_slug === 'cardiology';
                    
                    return (
                      <View style={styles.specBox} key={specId}>
                        <TouchableOpacity 
                          style={styles.specCheckRow}
                          onPress={() => {
                            setSelectedSpecs(prev => {
                              const current = prev[specId];
                              if (current?.checked) {
                                const copy = { ...prev };
                                delete copy[specId];
                                return copy;
                              } else {
                                return {
                                  ...prev,
                                  [specId]: {
                                    checked: true,
                                    years: isCardiology ? '12' : '5',
                                    primary: isCardiology,
                                    sub_specialties: isCardiology ? ['interventional'] : []
                                  }
                                };
                              }
                            });
                          }}
                        >
                          <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
                            {isChecked && <Text style={styles.checkmark}>✓</Text>}
                          </View>
                          <Text style={styles.specName}>
                            {spec.specialization_name}{isCardiology ? ' (Primary)' : ''}
                          </Text>
                        </TouchableOpacity>

                        {isChecked && (
                          <View style={styles.specSubOptions}>
                            <View style={styles.dropdownRow}>
                              <Text style={styles.subLabel}>Years of experience:</Text>
                              <TextInput
                                style={styles.yearsInput}
                                className="doctor-input"
                                value={years}
                                onChangeText={(text) => {
                                  setSelectedSpecs(prev => ({
                                    ...prev,
                                    [specId]: {
                                      ...prev[specId],
                                      years: text
                                    }
                                  }));
                                }}
                                keyboardType="numeric"
                              />
                              <Text style={styles.yearsText}>years</Text>
                            </View>
                            
                            {isCardiology && (
                              <>
                                <Text style={styles.subLabel}>Sub-specializations (optional):</Text>
                                <View style={styles.subCheckGrid}>
                                  {[
                                    { key: 'interventional', label: 'Interventional Cardiology' },
                                    { key: 'pediatric', label: 'Pediatric Cardiology' },
                                    { key: 'electrophysiology', label: 'Electrophysiology' }
                                  ].map(sub => {
                                    const subSelected = selectedSpecs[specId]?.sub_specialties?.includes(sub.key);
                                    return (
                                      <TouchableOpacity 
                                        key={sub.key}
                                        style={styles.subCheckRow}
                                        onPress={() => {
                                          setSelectedSpecs(prev => {
                                            const currentSub = prev[specId]?.sub_specialties || [];
                                            const newSub = currentSub.includes(sub.key)
                                              ? currentSub.filter(k => k !== sub.key)
                                              : [...currentSub, sub.key];
                                            return {
                                              ...prev,
                                              [specId]: {
                                                ...prev[specId],
                                                sub_specialties: newSub
                                              }
                                            };
                                          });
                                        }}
                                      >
                                        <View style={[styles.miniCheck, subSelected && styles.miniCheckChecked]}>
                                          {subSelected && <Text style={styles.miniCheckmark}>✓</Text>}
                                        </View>
                                        <Text style={styles.subCheckLabel}>{sub.label}</Text>
                                      </TouchableOpacity>
                                    );
                                  })}
                                </View>
                              </>
                            )}
                          </View>
                        )}
                      </View>
                    );
                  })}
              </>
            )}

            {/* custom specializations */}
            {customSpecs.map((spec, idx) => (
              <View style={styles.specBox} key={`custom-${idx}`}>
                <TouchableOpacity 
                  style={styles.specCheckRow}
                  onPress={() => {
                    const copy = [...customSpecs];
                    copy[idx].checked = !copy[idx].checked;
                    setCustomSpecs(copy);
                  }}
                >
                  <View style={[styles.checkbox, spec.checked && styles.checkboxChecked]}>
                    {spec.checked && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <Text style={styles.specName}>{spec.name}</Text>
                </TouchableOpacity>

                {spec.checked && (
                  <View style={styles.specSubOptions}>
                    <View style={styles.dropdownRow}>
                      <Text style={styles.subLabel}>Years of experience:</Text>
                      <TextInput
                        style={styles.yearsInput}
                        className="doctor-input"
                        value={spec.years}
                        onChangeText={(text) => {
                          const copy = [...customSpecs];
                          copy[idx].years = text;
                          setCustomSpecs(copy);
                        }}
                        keyboardType="numeric"
                      />
                      <Text style={styles.yearsText}>years</Text>
                    </View>
                  </View>
                )}
              </View>
            ))}

            {/* Add Custom spec input block */}
            {showAddCustom ? (
              <View style={styles.addCustomSpecBox}>
                <TextInput
                  style={styles.input}
                  className="doctor-input"
                  placeholder="Enter specialization name..."
                  placeholderTextColor="#827E8C"
                  value={newSpecName}
                  onChangeText={setNewSpecName}
                />
                <View style={styles.customSpecActions}>
                  <TouchableOpacity style={styles.miniBtn} onPress={handleAddCustomSpec}>
                    <Text style={styles.miniBtnText}>Add</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.miniBtn, { backgroundColor: '#EF4444' }]} onPress={() => setShowAddCustom(false)}>
                    <Text style={styles.miniBtnText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity style={styles.addMoreSpecBtn} onPress={() => setShowAddCustom(true)}>
                <Text style={styles.addMoreSpecText}>[+ ADD MORE SPECIALIZATION]</Text>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity style={styles.button} className="doctor-apply-btn" onPress={handleNextStep}>
            <Text style={styles.buttonText}>CONTINUE TO STEP 2</Text>
          </TouchableOpacity>
        </View>
      )}
      {/* STEP 2: Professional License & Credentials */}
      {step === 2 && (
        <View style={{ width: '100%' }}>
          
          {/* License & Certificates */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🛡️ License & Certificates</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Medical License Number</Text>
              <TextInput
                style={styles.input}
                className="doctor-input"
                placeholder="e.g. MDCN/12345"
                placeholderTextColor="#6B7280"
                value={licenseNumber}
                onChangeText={setLicenseNumber}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Licensing Board / Council</Text>
              <TextInput
                style={styles.input}
                className="doctor-input"
                placeholder="e.g. Medical and Dental Council of Nigeria"
                placeholderTextColor="#6B7280"
                value={licensingBoard}
                onChangeText={setLicensingBoard}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Graduation Year</Text>
              <TextInput
                style={styles.input}
                className="doctor-input"
                placeholder="e.g. 2012"
                placeholderTextColor="#6B7280"
                keyboardType="numeric"
                value={gradYear}
                onChangeText={setGradYear}
              />
            </View>

            {/* Document Uploads */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Upload License Document (PDF/Image)</Text>
              <DragAndDropZone 
                label="License Document" 
                fileName={fileName} 
                onFileDrop={setFileName} 
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Upload MDCN Certificate (PDF/Image)</Text>
              <DragAndDropZone 
                label="MDCN Certificate" 
                fileName={mdcnCertFileName} 
                onFileDrop={setMdcnCertFileName} 
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Upload ID Document (PDF/Image)</Text>
              <DragAndDropZone 
                label="ID Document" 
                fileName={idDocFileName} 
                onFileDrop={setIdDocFileName} 
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Upload CV/Resume (PDF)</Text>
              <DragAndDropZone 
                label="CV/Resume" 
                fileName={cvFileName} 
                onFileDrop={setCvFileName} 
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Upload Profile Photo (Image)</Text>
              <DragAndDropZone 
                label="Profile Photo" 
                fileName={profilePhotoName} 
                onFileDrop={setProfilePhotoName} 
                isImage={true}
              />
            </View>
          </View>

          {/* Qualifications */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🎓 Qualifications</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Degree</Text>
              <TextInput
                style={styles.input}
                className="doctor-input"
                placeholder="e.g. MBBS"
                placeholderTextColor="#6B7280"
                value={qualDegree}
                onChangeText={setQualDegree}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Institution</Text>
              <TextInput
                style={styles.input}
                className="doctor-input"
                placeholder="e.g. University of Lagos"
                placeholderTextColor="#6B7280"
                value={qualInstitution}
                onChangeText={setQualInstitution}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Year</Text>
              <TextInput
                style={styles.input}
                className="doctor-input"
                placeholder="e.g. 2012"
                placeholderTextColor="#6B7280"
                keyboardType="numeric"
                value={qualYear}
                onChangeText={setQualYear}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Certificate Document (PDF/Image)</Text>
              <DragAndDropZone 
                label="Certificate Document" 
                fileName={qualCertFileName} 
                onFileDrop={setQualCertFileName} 
              />
            </View>

            <TouchableOpacity 
              style={[styles.addButton, { marginBottom: 16 }]} 
              onPress={handleAddQualification}
            >
              <Text style={styles.addButtonText}>[+ ADD QUALIFICATION]</Text>
            </TouchableOpacity>

            {/* List qualifications */}
            {qualifications.map((q, idx) => (
              <View key={idx} style={styles.listCard}>
                <View style={styles.listCardContent}>
                  <Text style={styles.listCardTitle}>{q.degree} — {q.institution} ({q.year})</Text>
                  <Text style={styles.listCardSubtitle}>📄 {q.certificate}</Text>
                </View>
                <TouchableOpacity 
                  onPress={() => setQualifications(qualifications.filter((_, i) => i !== idx))}
                  style={styles.deleteListBtn}
                >
                  <Text style={styles.deleteListBtnText}>Remove</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>

          {/* Work Experience */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>💼 Work Experience</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Hospital / Clinic</Text>
              <TextInput
                style={styles.input}
                className="doctor-input"
                placeholder="e.g. Reddington Hospital"
                placeholderTextColor="#6B7280"
                value={expHospital}
                onChangeText={setExpHospital}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Position</Text>
              <TextInput
                style={styles.input}
                className="doctor-input"
                placeholder="e.g. Consultant Cardiologist"
                placeholderTextColor="#6B7280"
                value={expPosition}
                onChangeText={setExpPosition}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>From Year</Text>
              <TextInput
                style={styles.input}
                className="doctor-input"
                placeholder="e.g. 2018"
                placeholderTextColor="#6B7280"
                keyboardType="numeric"
                value={expFrom}
                onChangeText={setExpFrom}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>To Year</Text>
              <TextInput
                style={styles.input}
                className="doctor-input"
                placeholder="e.g. Present"
                placeholderTextColor="#6B7280"
                value={expTo}
                onChangeText={setExpTo}
              />
            </View>

            <TouchableOpacity 
              style={[styles.addButton, { marginBottom: 16 }]} 
              onPress={handleAddExperience}
            >
              <Text style={styles.addButtonText}>[+ ADD EXPERIENCE]</Text>
            </TouchableOpacity>

            {/* List experiences */}
            {experiences.map((e, idx) => (
              <View key={idx} style={styles.listCard}>
                <View style={styles.listCardContent}>
                  <Text style={styles.listCardTitle}>{e.position} at {e.hospital}</Text>
                  <Text style={styles.listCardSubtitle}>{e.from} — {e.to}</Text>
                </View>
                <TouchableOpacity 
                  onPress={() => setExperiences(experiences.filter((_, i) => i !== idx))}
                  style={styles.deleteListBtn}
                >
                  <Text style={styles.deleteListBtnText}>Remove</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>

          <TouchableOpacity style={styles.button} className="doctor-apply-btn" onPress={handleNextStep}>
            <Text style={styles.buttonText}>CONTINUE TO STEP 3</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* STEP 3: Consultation Pricing & Wallet Settings */}
      {step === 3 && (
        <View style={{ width: '100%' }}>
          {/* Consultation & Earnings Settings Card */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>💰 Consultation & Earnings Settings</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Consultation Fee (NGN ₦ per 30 minutes)</Text>
              <TextInput
                style={styles.input}
                className="doctor-input"
                placeholder="₦5,000 per session (30 minutes)"
                placeholderTextColor="#6B7280"
                keyboardType="numeric"
                value={consultationFee}
                onChangeText={setConsultationFee}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Live Stream Entry Fee (NGN ₦ per viewer)</Text>
              <TextInput
                style={styles.input}
                className="doctor-input"
                placeholder="₦500 per viewer"
                placeholderTextColor="#6B7280"
                keyboardType="numeric"
                value={liveStreamFee}
                onChangeText={setLiveStreamFee}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Accept Points Payment</Text>
              <TouchableOpacity 
                style={styles.pointsToggleRow}
                onPress={() => setAcceptPoints(!acceptPoints)}
              >
                <View style={[styles.checkbox, acceptPoints && styles.checkboxChecked]}>
                  {acceptPoints && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.pointsToggleLabel}>✅ Yes, accept points (100 points = ₦1)</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Payout Bank Name</Text>
              <TextInput
                style={styles.input}
                className="doctor-input"
                placeholder="e.g. GTBank"
                placeholderTextColor="#6B7280"
                value={bankName}
                onChangeText={setBankName}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Bank Account Number</Text>
              <TextInput
                style={styles.input}
                className="doctor-input"
                placeholder="e.g. 0123456789"
                placeholderTextColor="#6B7280"
                keyboardType="numeric"
                value={accountNumber}
                onChangeText={setAccountNumber}
              />
            </View>
          </View>

          {/* Availability Schedule Card */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🕐 Availability Schedule</Text>
            
            {Object.keys(schedule).map((day) => {
              const dayConfig = schedule[day];
              return (
                <View key={day} style={styles.scheduleRow}>
                  <TouchableOpacity 
                    style={styles.scheduleDayLeft}
                    onPress={() => {
                      setSchedule(prev => ({
                        ...prev,
                        [day]: {
                          ...prev[day],
                          enabled: !prev[day].enabled
                        }
                      }));
                    }}
                  >
                    <View style={[styles.checkbox, dayConfig.enabled && styles.checkboxChecked]}>
                      {dayConfig.enabled && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <Text style={styles.scheduleDayLabel}>{day}</Text>
                  </TouchableOpacity>

                  {dayConfig.enabled ? (
                    <View style={styles.scheduleTimeInputs}>
                      <TextInput
                        style={styles.scheduleTimeInput}
                        className="doctor-input"
                        placeholder="09:00 AM"
                        placeholderTextColor="#6B7280"
                        value={dayConfig.fromTime}
                        onChangeText={(text) => {
                          setSchedule(prev => ({
                            ...prev,
                            [day]: {
                              ...prev[day],
                              fromTime: text
                            }
                          }));
                        }}
                      />
                      <Text style={styles.scheduleTimeSeparator}>to</Text>
                      <TextInput
                        style={styles.scheduleTimeInput}
                        className="doctor-input"
                        placeholder="05:00 PM"
                        placeholderTextColor="#6B7280"
                        value={dayConfig.toTime}
                        onChangeText={(text) => {
                          setSchedule(prev => ({
                            ...prev,
                            [day]: {
                              ...prev[day],
                              toTime: text
                            }
                          }));
                        }}
                      />
                    </View>
                  ) : (
                    <Text style={styles.scheduleUnavailableText}>Unavailable</Text>
                  )}
                </View>
              );
            })}

            <TouchableOpacity 
              style={styles.copyWeekdaysBtn} 
              onPress={handleCopyToWeekdays}
            >
              <Text style={styles.copyWeekdaysText}>[COPY TO ALL WEEKDAYS]</Text>
            </TouchableOpacity>
          </View>

          {/* Bio Card */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📝 Bio</Text>
            <View style={styles.inputGroup}>
              <TextInput
                style={[styles.input, styles.multilineInput]}
                className="doctor-input"
                placeholder="Dr. Adeleke is a board-certified cardiologist with over 12 years of experience..."
                placeholderTextColor="#6B7280"
                multiline
                numberOfLines={4}
                value={bio}
                onChangeText={setBio}
              />
            </View>
          </View>

          {/* Warnings & Submission */}
          <View style={styles.infoAlertBox}>
            <Text style={styles.infoAlertText}>⚠️ Verification takes 1-3 business days. You will be notified by email.</Text>
            <Text style={[styles.infoAlertText, { marginTop: 6 }]}>💰 Once verified, you can start earning 70-85% of consultation fees.</Text>
          </View>

          <TouchableOpacity 
            style={styles.button} 
            className="doctor-apply-btn" 
            onPress={handleSubmitApplication}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#0A090E" />
            ) : (
              <Text style={styles.buttonText}>SUBMIT APPLICATION</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {Platform.OS === 'web' && (
        <style dangerouslySetInnerHTML={{__html: `
          .doctor-input:focus {
            border-color: #00d2ff !important;
            box-shadow: 0 0 10px rgba(0, 210, 255, 0.2);
            transition: all 0.25s ease;
          }
          .doctor-apply-btn {
            background: linear-gradient(135deg, #00d2ff 0%, #4facfe 100%);
            transition: all 0.25s ease;
          }
          .doctor-apply-btn:hover {
            opacity: 0.95;
            box-shadow: 0 0 20px rgba(0, 210, 255, 0.45);
            transform: translateY(-1px);
          }
          .telemed-card {
            background: rgba(22, 21, 33, 0.8) !important;
            backdrop-filter: blur(15px);
            -webkit-backdrop-filter: blur(15px);
            border: 1px solid rgba(0, 210, 255, 0.15) !important;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4), 0 0 20px rgba(0, 210, 255, 0.05);
            transition: all 0.3s ease;
          }
          .telemed-card:hover {
            border-color: rgba(0, 210, 255, 0.3) !important;
            box-shadow: 0 10px 45px rgba(0, 0, 0, 0.5), 0 0 25px rgba(0, 210, 255, 0.1);
          }
        `}} />
      )}

      {isMobile ? (
        // Mobile layout
        <ScrollView contentContainerStyle={styles.mobileContainer} keyboardShouldPersistTaps="handled">
          <Image source={{ uri: doctorImage }} style={styles.bgImageFull} resizeMode="cover" />
          <View style={styles.gradientOverlayFull} />
          {renderFormCard()}
        </ScrollView>
      ) : (
        // Desktop split layout
        <View style={styles.desktopContainer}>
          {/* Left panel: imagery and branding */}
          <View style={styles.leftSplit}>
            <Image source={{ uri: doctorImage }} style={styles.splitImage} resizeMode="cover" />
            <View style={styles.gradientOverlaySplit} />
            <View style={styles.leftSplitContent}>
              <Text style={styles.leftSplitMiniHeader}>⚡ {portalSubtitle.toUpperCase()}</Text>
              <Text style={styles.leftSplitTitle}>{portalName}</Text>
              <Text style={styles.leftSplitDesc}>{portalDesc}</Text>
              <View style={styles.featureRow}>
                <View style={styles.featureItem}>
                  <Text style={styles.featureIcon}>🛡️</Text>
                  <Text style={styles.featureText}>Secure Records</Text>
                </View>
                <View style={styles.featureItem}>
                  <Text style={styles.featureIcon}>🚀</Text>
                  <Text style={styles.featureText}>Fast Diagnoses</Text>
                </View>
                <View style={styles.featureItem}>
                  <Text style={styles.featureIcon}>📄</Text>
                  <Text style={styles.featureText}>E-Prescriptions</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Right panel: Form */}
          <ScrollView contentContainerStyle={styles.rightSplit} keyboardShouldPersistTaps="handled">
            {renderFormCard()}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0E17',
    position: 'relative'
  },
  // Mobile layout styles
  mobileContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    paddingVertical: 40,
    minHeight: '100vh',
    position: 'relative'
  },
  bgImageFull: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    opacity: 0.35
  },
  gradientOverlayFull: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'linear-gradient(to bottom, rgba(15, 14, 23, 0.8) 0%, #0F0E17 100%)'
  },
  card: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: 'rgba(22, 21, 33, 0.85)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(0, 210, 255, 0.15)',
    padding: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
  },
  // Desktop layout styles
  desktopContainer: {
    flex: 1,
    flexDirection: 'row',
    height: '100vh',
    minHeight: 650
  },
  leftSplit: {
    flex: 1.1,
    position: 'relative',
    justifyContent: 'flex-end',
    padding: 60,
    overflow: 'hidden'
  },
  splitImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    opacity: 0.6
  },
  gradientOverlaySplit: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'linear-gradient(to top, #0F0E17 10%, rgba(15, 14, 23, 0.4) 100%)'
  },
  leftSplitContent: {
    zIndex: 10,
    maxWidth: 550
  },
  leftSplitMiniHeader: {
    color: '#00d2ff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 12
  },
  leftSplitTitle: {
    color: '#FFFFF2',
    fontSize: 34,
    fontWeight: '800',
    lineHeight: 42,
    marginBottom: 16
  },
  leftSplitDesc: {
    color: '#A8A4CE',
    fontSize: 14.5,
    lineHeight: 22,
    marginBottom: 30
  },
  featureRow: {
    flexDirection: 'row',
    gap: 20
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  featureIcon: {
    marginRight: 6,
    fontSize: 14
  },
  featureText: {
    color: '#FFFFF2',
    fontSize: 12,
    fontWeight: '600'
  },
  rightSplit: {
    flex: 1,
    backgroundColor: '#0A090E',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.03)'
  },
  glassCardDesktop: {
    width: '100%',
    maxWidth: 520,
    borderRadius: 24,
    paddingVertical: 40,
    paddingHorizontal: 40,
    alignItems: 'center',
    boxShadow: '0 25px 60px rgba(0, 0, 0, 0.45)',
    borderWidth: 1,
    borderColor: 'rgba(0, 210, 255, 0.15)'
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    width: '100%'
  },
  backBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    cursor: 'pointer'
  },
  backBtnText: {
    color: '#00d2ff',
    fontSize: 13.5,
    fontWeight: '700',
  },
  headerTitle: {
    color: '#FFFFF2',
    fontSize: 15.5,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  stepIndicator: {
    color: '#827E8C',
    fontSize: 12.5,
    fontWeight: '600',
  },
  errorBox: {
    width: '100%',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 12.5,
    fontWeight: '500',
  },
  section: {
    width: '100%',
    backgroundColor: '#161521',
    borderWidth: 1,
    borderColor: '#2C2B35',
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
  },
  sectionTitle: {
    color: '#FFFFF2',
    fontSize: 13.5,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 14,
    width: '100%',
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  label: {
    color: '#A8A4CE',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    width: '100%',
    height: 38,
    backgroundColor: '#0F0E17',
    borderWidth: 1,
    borderColor: '#2C2B35',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 13,
    color: '#FFFFF2',
    outlineStyle: 'none',
  },
  inputDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    color: '#827E8C'
  },
  multilineInput: {
    height: 80,
    paddingTop: 8,
    paddingBottom: 8,
    textAlignVertical: 'top'
  },
  specBox: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
    paddingBottom: 14,
    marginBottom: 14
  },
  specCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    cursor: 'pointer'
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(0, 210, 255, 0.4)',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    backgroundColor: '#0F0E17',
  },
  checkboxChecked: {
    borderColor: '#00d2ff',
    backgroundColor: 'rgba(0, 210, 255, 0.1)',
  },
  checkmark: {
    color: '#00d2ff',
    fontSize: 13,
    fontWeight: '900',
  },
  specName: {
    color: '#FFFFF2',
    fontSize: 14,
    fontWeight: '700'
  },
  specSubOptions: {
    marginTop: 12,
    paddingLeft: 32,
  },
  dropdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8
  },
  subLabel: {
    color: '#A8A4CE',
    fontSize: 12.5,
    fontWeight: '600'
  },
  yearsInput: {
    width: 60,
    height: 30,
    backgroundColor: '#0F0E17',
    borderWidth: 1,
    borderColor: '#2C2B35',
    borderRadius: 6,
    color: '#FFFFF2',
    textAlign: 'center',
    fontSize: 13,
  },
  yearsText: {
    color: '#A8A4CE',
    fontSize: 12.5
  },
  subCheckGrid: {
    marginTop: 8,
    flexDirection: 'column',
    gap: 8
  },
  subCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    cursor: 'pointer'
  },
  miniCheck: {
    width: 16,
    height: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(0, 210, 255, 0.3)',
    borderRadius: 3,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    backgroundColor: '#0F0E17',
  },
  miniCheckChecked: {
    borderColor: '#00d2ff',
    backgroundColor: 'rgba(0, 210, 255, 0.1)',
  },
  miniCheckmark: {
    color: '#00d2ff',
    fontSize: 10,
    fontWeight: '900',
  },
  subCheckLabel: {
    color: '#827E8C',
    fontSize: 12.5,
    fontWeight: '500'
  },
  addMoreSpecBtn: {
    paddingVertical: 8,
    cursor: 'pointer',
    alignSelf: 'flex-start'
  },
  addMoreSpecText: {
    color: '#00d2ff',
    fontSize: 12.5,
    fontWeight: '700'
  },
  addCustomSpecBox: {
    marginTop: 10,
    gap: 10,
    backgroundColor: '#0F0E17',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2C2B35'
  },
  customSpecActions: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end'
  },
  miniBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#00d2ff',
    cursor: 'pointer'
  },
  miniBtnText: {
    color: '#0A090E',
    fontSize: 12,
    fontWeight: '700'
  },
  uploadZone: {
    backgroundColor: '#0F0E17',
    borderWidth: 1.5,
    borderColor: 'rgba(0, 210, 255, 0.25)',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderStyle: 'dashed'
  },
  uploadIcon: {
    fontSize: 24,
    marginBottom: 8
  },
  uploadFileName: {
    color: '#FFFFF2',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4
  },
  uploadHint: {
    color: '#827E8C',
    fontSize: 11
  },
  button: {
    width: '100%',
    height: 48,
    borderRadius: 12,
    backgroundColor: '#00d2ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    cursor: 'pointer',
  },
  buttonText: {
    color: '#0A090E',
    fontSize: 13.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  uploadZoneDragging: {
    borderColor: '#00d2ff',
    backgroundColor: 'rgba(0, 210, 255, 0.1)'
  },
  uploadZoneSuccess: {
    borderColor: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.05)'
  },
  addButton: {
    width: '100%',
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#00d2ff',
    justifyContent: 'center',
    alignItems: 'center',
    cursor: 'pointer',
    backgroundColor: 'transparent'
  },
  addButtonText: {
    color: '#00d2ff',
    fontSize: 13,
    fontWeight: '700'
  },
  listCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#14131D',
    borderWidth: 1,
    borderColor: '#2C2B35',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 10
  },
  listCardContent: {
    flex: 1,
    gap: 4
  },
  listCardTitle: {
    color: '#FFFFF2',
    fontSize: 13,
    fontWeight: '700'
  },
  listCardSubtitle: {
    color: '#827E8C',
    fontSize: 11.5
  },
  deleteListBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: '#EF4444',
    cursor: 'pointer'
  },
  deleteListBtnText: {
    color: '#EF4444',
    fontSize: 11,
    fontWeight: '700'
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)'
  },
  scheduleDayLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    cursor: 'pointer',
    width: 140
  },
  scheduleDayLabel: {
    color: '#FFFFF2',
    fontSize: 13,
    fontWeight: '700'
  },
  scheduleTimeInputs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    justifyContent: 'flex-end'
  },
  scheduleTimeInput: {
    width: 85,
    height: 32,
    backgroundColor: '#0F0E17',
    borderWidth: 1,
    borderColor: '#2C2B35',
    borderRadius: 6,
    color: '#FFFFF2',
    textAlign: 'center',
    fontSize: 12,
    outlineStyle: 'none'
  },
  scheduleTimeSeparator: {
    color: '#827E8C',
    fontSize: 12
  },
  scheduleUnavailableText: {
    color: '#827E8C',
    fontSize: 12.5,
    fontStyle: 'italic'
  },
  copyWeekdaysBtn: {
    alignSelf: 'center',
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#00d2ff',
    cursor: 'pointer',
    backgroundColor: 'transparent'
  },
  copyWeekdaysText: {
    color: '#00d2ff',
    fontSize: 12,
    fontWeight: '700'
  },
  pointsToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    cursor: 'pointer',
    marginTop: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2C2B35'
  },
  pointsToggleLabel: {
    color: '#FFFFF2',
    fontSize: 13,
    fontWeight: '600'
  },
  infoAlertBox: {
    width: '100%',
    backgroundColor: 'rgba(251, 191, 36, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.25)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20
  },
  infoAlertText: {
    color: '#FBBF24',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18
  }
});
