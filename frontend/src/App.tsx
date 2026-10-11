import { useState, useRef, useEffect } from 'react';
import html2canvas from 'html2canvas';
import logoImg from './assets/seafoodz.jpeg';
import { getCustomers, getBills, createBill, updateCustomer, deleteBill, formatDisplayDate, formatDateToDMY, formatDateToYMD } from './api';
import type { CustomerData, SavedBill, BillItem } from './api';

// Common fish types in Tamil
const FISH_TYPES = [
  'ஜிலேபி (Jalebi)',
  'சங்கரா (Sankara)',
  'வஞ்சரம் (Vanjaram)',
  'மத்தி (Mathi)',
  'வவ்வால் (BIG)',
  'இறால் (Prawn)',
  'நெத்திலி (Nethili)',
  'சூரை (Tuna)',
  'கானாங்கெளுத்தி (Mackerel)',
  'வவ்வால் (MEDIUM)',
  'வவ்வால் (SMALL)',
  'பங்காஸ் (Pangas)',
  'கெண்டை (Kendai)',
  'நண்டு (Crab)',
  'கொடுவா (Koduva)'
  
];

// Pre-loaded customers as requested
const INITIAL_CUSTOMERS: Record<string, CustomerData> = {
  "பச்சையப்பன் - கந்தம்பாளையம்": { name: "பச்சையப்பன்", address: "கந்தம்பாளையம்", balance: 0 },
  "முருகன் - வேட்டவலம்": { name: "முருகன்", address: "வேட்டவலம்", balance: 0 },
  "ஹரிதாஸ் - வேட்டவலம்": { name: "ஹரிதாஸ்", address: "வேட்டவலம்", balance: 0 },
  "முரளி - வேட்டவலம்": { name: "முரளி", address: "வேட்டவலம்", balance: 0 },
  "பெருமாள் - கண்டாச்சிபுரம்": { name: "பெருமாள்", address: "கண்டாச்சிபுரம்", balance: 0 },
  "கோபி - கண்டாச்சிபுரம்": { name: "கோபி", address: "கண்டாச்சிபுரம்", balance: 0 },
  "முரளி - கண்டாச்சிபுரம்": { name: "முரளி", address: "கண்டாச்சிபுரம்", balance: 0 },
  "ராஜா - கண்டாச்சிபுரம்": { name: "ராஜா", address: "கண்டாச்சிபுரம்", balance: 0 },
  "ஏழுமலை - கண்டாச்சிபுரம்": { name: "ஏழுமலை", address: "கண்டாச்சிபுரம்", balance: 0 },
  "சுரேஷ் - உளுந்தூர்பேட்டை": { name: "சுரேஷ்", address: "உளுந்தூர்பேட்டை", balance: 0 },
  "விஜி - விருத்தாச்சலம்": { name: "விஜி", address: "விருத்தாச்சலம்", balance: 0 },
  "SRS சிவராஜ் - விழுப்புரம்": { name: "SRS சிவராஜ்", address: "விழுப்புரம்", balance: 0 }
};

function App() {
  const getTodayDate = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${dd}-${mm}-${yyyy}`;
  };

  const datePickerRef = useRef<HTMLInputElement>(null);

  const [billNo, setBillNo] = useState<string>('101');
  
  const [date, setDate] = useState<string>(getTodayDate);
  
  const [customerName, setCustomerName] = useState('');
  const [address, setAddress] = useState('');
  // This state holds what is typed in the combined search box
  const [searchKey, setSearchKey] = useState('');
  
  const [items, setItems] = useState<BillItem[]>(() => [
    { id: Date.now().toString(), particulars: FISH_TYPES[0], qty: '', rate: '' }
  ]);
  
  const [prevBalance, setPrevBalance] = useState<string>('');
  const [advance, setAdvance] = useState<string>('');

  const [savedCustomers, setSavedCustomers] = useState<Record<string, CustomerData>>(INITIAL_CUSTOMERS);
  const [savedBills, setSavedBills] = useState<SavedBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [customersData, billsData] = await Promise.all([
          getCustomers(),
          getBills()
        ]);
        
        const customerMap: Record<string, CustomerData> = { ...INITIAL_CUSTOMERS };
        if (Array.isArray(customersData)) {
          customersData.forEach(c => {
            if (c && c.name) {
              customerMap[`${c.name} - ${c.address || ''}`] = c;
            }
          });
        }
        setSavedCustomers(customerMap);
        setSavedBills(Array.isArray(billsData) ? billsData : []);
        
        if (Array.isArray(billsData) && billsData.length > 0) {
          const maxBill = Math.max(...billsData.map(b => parseInt(b.billNo) || 0));
          if (maxBill > 0) {
            setBillNo((maxBill + 1).toString());
          }
        }
      } catch (err: any) {
        console.warn('Initial data load warning:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Modal State for "Previous Balance Payment"
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentCustomerKey, setPaymentCustomerKey] = useState('');
  const [paymentAmount, setPaymentAmount] = useState<string>('');

  const loadBill = (bill: SavedBill) => {
    setBillNo(bill.billNo);
    setDate(formatDateToDMY(bill.date));
    setCustomerName(bill.customerName);
    setAddress(bill.address);
    setSearchKey(`${bill.customerName} - ${bill.address}`);
    setItems(bill.items.map(it => ({
      ...it,
      qty: it.quantity !== undefined ? it.quantity : (it.qty !== undefined ? it.qty : ''),
      rate: it.price !== undefined ? it.price : (it.rate !== undefined ? it.rate : ''),
      quantity: it.quantity !== undefined ? it.quantity : (it.qty !== undefined ? it.qty : ''),
      price: it.price !== undefined ? it.price : (it.rate !== undefined ? it.rate : '')
    })));
    setPrevBalance(String(bill.previousBalance ?? bill.prevBalance ?? ''));
    setAdvance(String(bill.advance ?? bill.receipt ?? ''));
    setShowHistoryModal(false);
  };

  const handleDeleteBill = async (bill: SavedBill) => {
    const confirmDelete = window.confirm(`Are you sure you want to remove Bill No: ${bill.billNo} (${bill.customerName})?`);
    if (!confirmDelete) return;

    try {
      await deleteBill(bill.id, bill.billNo);
      setSavedBills(prev => prev.filter(b => (bill.id && b.id ? b.id !== bill.id : b !== bill)));
    } catch (err: any) {
      alert('Error removing bill: ' + err.message);
    }
  };
  
  // Ref for the bill container to download image
  const billPreviewRef = useRef<HTMLDivElement>(null);

  const handleSearchChange = (key: string) => {
    setSearchKey(key);
    
    // If they picked an exact match from the dropdown list
    if (savedCustomers[key]) {
      setCustomerName(savedCustomers[key].name);
      setAddress(savedCustomers[key].address);
      const bal = savedCustomers[key].balance;
      setPrevBalance(bal === 0 ? '' : bal.toString());
    } else {
      // If it's a new customer being typed manually
      if (key.includes('-')) {
        const parts = key.split('-');
        setCustomerName(parts[0].trim());
        setAddress(parts[1].trim());
      } else {
        setCustomerName(key);
        setAddress('');
      }
      setPrevBalance('');
    }
  };

  const handleManualEdit = (newName: string, newAddress: string) => {
    setCustomerName(newName);
    setAddress(newAddress);
    const combined = `${newName} - ${newAddress}`;
    setSearchKey(combined);
    
    if (savedCustomers[combined]) {
      const bal = savedCustomers[combined].balance;
      setPrevBalance(bal === 0 ? '' : bal.toString());
    } else {
      setPrevBalance('');
    }
  };

  const addItem = () => {
    setItems([...items, { id: Date.now().toString(), particulars: FISH_TYPES[0], qty: '', rate: '', quantity: '', price: '' }]);
  };

  const updateItem = (id: string | number | undefined, field: keyof BillItem, value: string) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        if (field === 'qty') updated.quantity = value;
        if (field === 'quantity') updated.qty = value;
        if (field === 'rate') updated.price = value;
        if (field === 'price') updated.rate = value;
        return updated;
      }
      return item;
    }));
  };

  const removeItem = (id: string | number | undefined) => {
    setItems(items.filter(item => item.id !== id));
  };

  const currentTotal = items.reduce((sum, item) => sum + ((Number(item.quantity ?? item.qty) || 0) * (Number(item.price ?? item.rate) || 0)), 0);
  const subTotal = currentTotal + (Number(prevBalance) || 0);
  const finalBalance = subTotal - (Number(advance) || 0);

  const handleSaveBill = async () => {
    if (!customerName.trim() || !address.trim()) {
      alert("Error: Please provide both Customer Name and Address before saving!");
      return;
    }

    const uniqueKey = `${customerName} - ${address}`;

    const newBill: SavedBill = {
      billNo,
      date: formatDateToDMY(date),
      customerName,
      address,
      items: items.map(it => ({
        ...it,
        quantity: it.quantity !== undefined && it.quantity !== '' ? it.quantity : (it.qty ?? ''),
        qty: it.quantity !== undefined && it.quantity !== '' ? it.quantity : (it.qty ?? ''),
        price: it.price !== undefined && it.price !== '' ? it.price : (it.rate ?? ''),
        rate: it.price !== undefined && it.price !== '' ? it.price : (it.rate ?? '')
      })),
      previousBalance: prevBalance,
      advance: advance,
      totalAmount: subTotal,
      finalBalance
    };

    try {
      const saved = await createBill(newBill);
      
      const updatedBills = [...savedBills, saved];
      setSavedBills(updatedBills);

      const updatedCustomer = {
        name: customerName,
        address: address,
        balance: finalBalance
      };
      
      const updatedCustomers = {
        ...savedCustomers,
        [uniqueKey]: updatedCustomer
      };
      setSavedCustomers(updatedCustomers);

      alert(`Bill Saved! ${customerName}'s new balance is Rs.${formatCurrency(finalBalance)}`);
      
      // Reset for next bill
      setBillNo((parseInt(billNo) + 1).toString());
      setDate(getTodayDate());
      setCustomerName('');
      setAddress('');
      setSearchKey('');
      setPrevBalance('');
      setAdvance('');
      setItems([{ id: Date.now().toString(), particulars: FISH_TYPES[0], qty: '', rate: '', quantity: '', price: '' }]);
    } catch (err: any) {
      alert('Error saving bill: ' + err.message);
    }
  };

  const handlePrint = () => {
    if (!customerName.trim() || !address.trim()) {
      alert("Error: Please provide both Customer Name and Address before printing!");
      return;
    }
    window.print();
  };

  const handleDownloadImage = async () => {
    if (!customerName.trim() || !address.trim()) {
      alert("Error: Please provide both Customer Name and Address before downloading!");
      return;
    }
    
    if (billPreviewRef.current) {
      try {
        const canvas = await html2canvas(billPreviewRef.current, { scale: 2 });
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        const link = document.createElement('a');
        link.download = `Bill_${billNo}_${customerName}.jpg`;
        link.href = dataUrl;
        link.click();
      } catch (err) {
        console.error("Failed to download image", err);
        alert("Sorry, there was an issue downloading the bill.");
      }
    }
  };

  const handleRefreshBill = () => {
    if (window.confirm("Are you sure you want to refresh and clear the current bill?")) {
      const maxBill = savedBills.length > 0 ? Math.max(...savedBills.map(b => parseInt(b.billNo) || 0)) : 100;
      setBillNo((maxBill + 1).toString());
      setDate(getTodayDate());
      setCustomerName('');
      setAddress('');
      setSearchKey('');
      setPrevBalance('');
      setAdvance('');
      setItems([{ id: Date.now().toString(), particulars: FISH_TYPES[0], qty: '', rate: '', quantity: '', price: '' }]);
    }
  };

  const handleSavePayment = async () => {
    if (!paymentCustomerKey || !savedCustomers[paymentCustomerKey]) {
      alert("Please select a valid customer.");
      return;
    }
    const payAmt = Number(paymentAmount) || 0;
    if (payAmt <= 0) {
      alert("Please enter a valid amount greater than 0.");
      return;
    }

    const customer = savedCustomers[paymentCustomerKey];
    const newBalance = customer.balance - payAmt;

    try {
      const updatedCustomerData = {
        ...customer,
        balance: newBalance
      };

      const savedCust = await updateCustomer(customer.id || 0, updatedCustomerData);
      if (savedCust?.id) {
        updatedCustomerData.id = savedCust.id;
      }

      const updatedCustomers = {
        ...savedCustomers,
        [paymentCustomerKey]: updatedCustomerData
      };

      setSavedCustomers(updatedCustomers);
      
      alert(`Payment Saved! ${customer.name}'s new balance is Rs.${formatCurrency(newBalance)}`);
      
      // Reset modal
      setShowPaymentModal(false);
      setPaymentCustomerKey('');
      setPaymentAmount('');
    } catch(err: any) {
      alert('Error saving payment: ' + err.message);
    }
  };

  const formatCurrency = (num: number) => {
    return num.toLocaleString('en-IN');
  };

  return (
    <div className="container">
      {error && (
        <div style={{ position: 'fixed', top: 10, right: 10, zIndex: 9999, background: '#dc3545', color: 'white', padding: '8px 14px', borderRadius: 6, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
          <span>Error: {error}</span>
          <button onClick={() => setError(null)} style={{ background: 'transparent', border: 'none', color: 'white', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px', lineHeight: 1 }} title="Dismiss">✕</button>
        </div>
      )}
      {loading && (
        <div style={{ position: 'fixed', bottom: 10, right: 10, zIndex: 9999, background: '#0b4b8a', color: 'white', padding: '6px 12px', borderRadius: 6, fontSize: '13px', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
          Loading data...
        </div>
      )}
      <div className="no-print">
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2>🐟 KKM sea foodz</h2>
          <div>
            <button 
              className="btn" 
              style={{ backgroundColor: '#17a2b8', color: '#fff', fontWeight: 'bold', marginRight: '10px' }} 
              onClick={() => setShowHistoryModal(true)}
            >
              📜 Previous Bills
            </button>
            <button 
              className="btn" 
              style={{ backgroundColor: '#ffc107', color: '#000', fontWeight: 'bold' }} 
              onClick={() => setShowPaymentModal(true)}
            >
              💰 முந்தைய இருப்பு (Receive Payment)
            </button>
          </div>
        </div>
        
        <div className="card">
          <div className="form-grid">
            <div className="form-group">
              <label>Bill No</label>
              <input type="text" value={billNo} onChange={e => setBillNo(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Date (DD-MM-YYYY)</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input 
                  type="text" 
                  value={date} 
                  onChange={e => setDate(e.target.value)} 
                  placeholder="DD-MM-YYYY"
                  style={{ width: '100%', paddingRight: '42px', fontWeight: 'bold', fontSize: '1rem' }}
                />
                <button 
                  type="button" 
                  onClick={() => {
                    try {
                      datePickerRef.current?.showPicker?.();
                    } catch {
                      datePickerRef.current?.focus();
                    }
                  }}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '20px',
                    lineHeight: 1
                  }}
                  title="Click to select date from calendar"
                >
                  📅
                </button>
                <input 
                  type="date" 
                  ref={datePickerRef}
                  value={formatDateToYMD(date)}
                  onChange={e => {
                    if (e.target.value) {
                      const [y, m, d] = e.target.value.split('-');
                      setDate(`${d}-${m}-${y}`);
                    }
                  }}
                  style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none', bottom: 0, right: 0 }}
                />
              </div>
            </div>
            
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label style={{ color: '#0b4b8a', fontWeight: 'bold' }}>🔎 Select Customer from List (Choose One)</label>
              <input 
                type="text" 
                list="customers-list"
                value={searchKey} 
                onChange={e => handleSearchChange(e.target.value)} 
                placeholder="Click to select from pre-loaded customers..."
                style={{ backgroundColor: '#e9ecef', border: '2px solid #0b4b8a' }}
              />
              <datalist id="customers-list">
                {Object.keys(savedCustomers).map(key => (
                  <option key={key} value={key} />
                ))}
              </datalist>
              {savedCustomers[`${customerName} - ${address}`] && savedCustomers[`${customerName} - ${address}`].balance !== 0 && (
                <div style={{ marginTop: '10px', color: '#842029', fontWeight: 'bold', fontSize: '1.1em', padding: '10px', backgroundColor: '#f8d7da', border: '1px solid #f5c2c7', borderRadius: '5px' }}>
                  ⚠️ This customer has a Previous Balance (முன் பாக்கி) of: Rs. {formatCurrency(savedCustomers[`${customerName} - ${address}`].balance)}
                </div>
              )}
            </div>

            <div className="form-group">
              <label>Name (For Bill)</label>
              <input 
                type="text" 
                value={customerName} 
                onChange={e => handleManualEdit(e.target.value, address)} 
              />
            </div>
            <div className="form-group">
              <label>Address (For Bill)</label>
              <input 
                type="text" 
                value={address} 
                onChange={e => handleManualEdit(customerName, e.target.value)} 
              />
            </div>
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: '1rem', fontSize: '1rem', display: 'flex', justifyContent: 'space-between' }}>
            Fish Items
            <button className="btn btn-primary" onClick={addItem}>+ Add Item</button>
          </h3>
          {items.map((item) => (
            <div className="item-row" key={item.id}>
              <div className="form-group">
                <label>Fish Type</label>
                <input 
                  type="text" 
                  list="fish-list"
                  value={item.particulars} 
                  onChange={e => updateItem(item.id, 'particulars', e.target.value)} 
                />
                <datalist id="fish-list">
                  {FISH_TYPES.map(fish => <option key={fish} value={fish} />)}
                </datalist>
              </div>
              <div className="form-group">
                <label>Qty (Box)</label>
                <input type="number" min="1" value={item.qty} onChange={e => updateItem(item.id, 'qty', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Rate (Rs)</label>
                <input type="number" min="0" value={item.rate} onChange={e => updateItem(item.id, 'rate', e.target.value)} />
              </div>
              <button className="btn btn-danger" onClick={() => removeItem(item.id)} style={{ marginBottom: '2px' }}>X</button>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="form-grid">
            <div className="form-group">
              <label>Previous Balance (முன் பாக்கி)</label>
              <input type="number" value={prevBalance} onChange={e => setPrevBalance(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Advance (முன் வரவு)</label>
              <input type="number" value={advance} onChange={e => setAdvance(e.target.value)} placeholder="0" />
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          <button className="btn" style={{ backgroundColor: '#0d6efd', color: 'white' }} onClick={handleSaveBill}>💾 Save & Next Bill</button>
          <button className="btn" style={{ backgroundColor: '#198754', color: 'white' }} onClick={handlePrint}>🖨️ Print / PDF</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
          <button className="btn" style={{ backgroundColor: '#6f42c1', color: 'white' }} onClick={handleDownloadImage}>⬇️ Download Image</button>
          <button className="btn" style={{ backgroundColor: '#dc3545', color: 'white' }} onClick={handleRefreshBill}>🔄 Refresh Bill</button>
        </div>
      </div>

      {/* History Modal */}
      {showHistoryModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="card no-print" style={{ width: '90%', maxWidth: '800px', maxHeight: '80vh', overflowY: 'auto', backgroundColor: '#fff', border: '2px solid #0b4b8a' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0, color: '#0b4b8a', borderBottom: 'none' }}>📜 Previous Bills History</h2>
              <button className="btn btn-danger" onClick={() => setShowHistoryModal(false)}>Close</button>
            </div>
            
            {savedBills.length === 0 ? (
              <p>No bills saved yet.</p>
            ) : (
              <table className="bill-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '8px', border: '1px solid #ccc', backgroundColor: '#f8f9fa' }}>Bill No</th>
                    <th style={{ padding: '8px', border: '1px solid #ccc', backgroundColor: '#f8f9fa' }}>Date</th>
                    <th style={{ padding: '8px', border: '1px solid #ccc', backgroundColor: '#f8f9fa' }}>Customer</th>
                    <th style={{ padding: '8px', border: '1px solid #ccc', backgroundColor: '#f8f9fa' }}>Total Amount</th>
                    <th style={{ padding: '8px', border: '1px solid #ccc', backgroundColor: '#f8f9fa' }}>Advance</th>
                    <th style={{ padding: '8px', border: '1px solid #ccc', backgroundColor: '#f8f9fa' }}>Final Balance</th>
                    <th style={{ padding: '8px', border: '1px solid #ccc', backgroundColor: '#f8f9fa' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {savedBills.slice().reverse().map((bill, index) => (
                    <tr key={bill.id || `${bill.billNo}-${index}`}>
                      <td style={{ padding: '8px', border: '1px solid #ccc' }} className="text-center">{bill.billNo}</td>
                      <td style={{ padding: '8px', border: '1px solid #ccc' }} className="text-center">{formatDisplayDate(bill.date)}</td>
                      <td style={{ padding: '8px', border: '1px solid #ccc' }}>{bill.customerName} - {bill.address}</td>
                      <td style={{ padding: '8px', border: '1px solid #ccc' }} className="text-right">{formatCurrency(bill.totalAmount)}</td>
                      <td style={{ padding: '8px', border: '1px solid #ccc' }} className="text-right">{formatCurrency(Number(bill.advance !== undefined ? bill.advance : bill.receipt) || 0)}</td>
                      <td style={{ padding: '8px', border: '1px solid #ccc' }} className="text-right font-bold">{formatCurrency(bill.finalBalance)}</td>
                      <td style={{ padding: '8px', border: '1px solid #ccc', whiteSpace: 'nowrap' }} className="text-center">
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          <button 
                            className="btn btn-primary" 
                            style={{ padding: '4px 10px', fontSize: '12px' }} 
                            onClick={() => loadBill(bill)}
                            title="View and Edit Bill"
                          >
                            👁️ View
                          </button>
                          <button 
                            className="btn btn-danger" 
                            style={{ padding: '4px 10px', fontSize: '12px', backgroundColor: '#dc3545', color: '#fff' }} 
                            onClick={() => handleDeleteBill(bill)}
                            title="Remove Bill"
                          >
                            🗑️ Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="card no-print" style={{ width: '90%', maxWidth: '400px', backgroundColor: '#fff', border: '2px solid #0b4b8a' }}>
            <h2 style={{ marginBottom: '1rem', color: '#0b4b8a' }}>💰 முந்தைய இருப்பு (Receive Payment)</h2>
            
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label>Select Customer</label>
              <input 
                type="text" 
                list="modal-customers-list"
                value={paymentCustomerKey} 
                onChange={e => setPaymentCustomerKey(e.target.value)} 
                placeholder="Click to select customer..."
              />
              <datalist id="modal-customers-list">
                {Object.keys(savedCustomers).map(key => (
                  <option key={key} value={key} />
                ))}
              </datalist>
            </div>

            {paymentCustomerKey && savedCustomers[paymentCustomerKey] && (
              <div style={{ backgroundColor: '#f8f9fa', padding: '10px', borderRadius: '5px', marginBottom: '1rem', border: '1px solid #ccc' }}>
                <p style={{ margin: 0, color: '#dc3545', fontWeight: 'bold' }}>
                  Current Pending Balance: Rs. {formatCurrency(savedCustomers[paymentCustomerKey].balance)}
                </p>
              </div>
            )}

            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label>Amount Received (வரவு)</label>
              <input 
                type="number" 
                value={paymentAmount} 
                onChange={e => setPaymentAmount(e.target.value)} 
                placeholder="Enter amount..."
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button className="btn" style={{ flex: 1, backgroundColor: '#6c757d', color: 'white' }} onClick={() => setShowPaymentModal(false)}>Cancel</button>
              <button className="btn" style={{ flex: 1, backgroundColor: '#198754', color: 'white' }} onClick={handleSavePayment}>Save Payment</button>
            </div>
          </div>
        </div>
      )}

      {/* Bill Preview Area */}
      <div className="bill-preview" ref={billPreviewRef} style={{ backgroundColor: 'white' }}>
        <div className="bill-header">
          <h3>ஸ்ரீ பச்சையம்மன் துணை</h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
            <span><b>CASH / CREDIT BILL</b></span>
            <span>Mobile: 9787178910<br/>8695172090</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '10px 0' }}>
            <img src={logoImg} alt="Logo Left" style={{ width: '70px', height: '70px', objectFit: 'contain', borderRadius: '50%' }} />
            <div style={{ textAlign: 'center', flex: 1 }}>
              <h1 style={{ margin: '0 0 5px 0' }}>KKM SEA FOODZ</h1>
              <h2 style={{ margin: 0, padding: 0, border: 'none' }}>FISH COMMISSION AGENT</h2>
            </div>
            <img src={logoImg} alt="Logo Right" style={{ width: '70px', height: '70px', objectFit: 'contain', borderRadius: '50%' }} />
          </div>
          <p>No.165, Murugan Kovil Sreet, MALAYARASANKUPPM, Villupuram-605701</p>
        </div>

        <div className="bill-info">
          <div><b>Bill No:</b> {billNo}</div>
          <div><b>Date:</b> {formatDisplayDate(date)}</div>
        </div>

        <div className="bill-customer">
          <div><b>Name:</b> {customerName}</div>
          <div><b>Address:</b> {address}</div>
        </div>

        <table className="bill-table">
          <thead>
            <tr>
              <th style={{ width: '10%' }}>SL No.</th>
              <th style={{ width: '40%' }}>Particulars</th>
              <th style={{ width: '15%' }}>Qty<br/><small>Box</small></th>
              <th style={{ width: '15%' }}>Rate<br/><small>Rs.</small></th>
              <th style={{ width: '20%' }}>Amount<br/><small>Rs.</small></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={item.id}>
                <td className="text-center">{index + 1}</td>
                <td>{item.particulars}</td>
                <td className="text-center">{item.qty}</td>
                <td>{formatCurrency(Number(item.rate) || 0)}</td>
                <td className="font-bold">{formatCurrency((Number(item.qty) || 0) * (Number(item.rate) || 0))}</td>
              </tr>
            ))}
            
            {/* Previous Balance Row */}
            <tr>
              <td colSpan={2} className="text-right font-bold" style={{color: 'blue'}}>முன் பாக்கி =&gt;</td>
              <td></td>
              <td></td>
              <td className="font-bold">{formatCurrency(Number(prevBalance) || 0)}</td>
            </tr>

            {/* Subtotal Row */}
            <tr>
              <td colSpan={4}></td>
              <td className="font-bold">{formatCurrency(subTotal)}</td>
            </tr>

            {/* Advance Row */}
            <tr>
              <td colSpan={2} className="text-right font-bold" style={{color: 'blue'}}>Advance (வரவு) =&gt;</td>
              <td></td>
              <td></td>
              <td className="font-bold">{formatCurrency(Number(advance) || 0)}</td>
            </tr>

            {/* Final Balance Row */}
            <tr>
              <td colSpan={3} rowSpan={3} style={{verticalAlign: 'bottom', borderRight: 'none'}}>
                <b>Thank You!</b>
              </td>
              <td className="font-bold">Total Amount</td>
              <td className="font-bold">{formatCurrency(subTotal)}</td>
            </tr>
            <tr>
              <td className="font-bold">Advance</td>
              <td className="font-bold">{formatCurrency(Number(advance) || 0)}</td>
            </tr>
            <tr>
              <td className="font-bold">Balance</td>
              <td className="font-bold">{formatCurrency(finalBalance)}</td>
            </tr>
          </tbody>
        </table>

        <div className="bill-footer">
          <div className="signature">Customer's Signature</div>
          <div className="signature">For KKM Sea Foodz</div>
        </div>
      </div>
    </div>
  );
}

export default App;
