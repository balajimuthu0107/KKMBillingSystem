import { useState, useRef, useEffect } from 'react';
import html2canvas from 'html2canvas';
import logoImg from './assets/seafoodz.jpeg';
import { getCustomers, getBills, createBill, createCustomer, updateCustomer, deleteBill, formatDisplayDate, formatDateToDMY, formatDateToYMD, DEFAULT_INITIAL_CUSTOMERS, getLocalCustomers } from './api';
import type { CustomerData, SavedBill, BillItem } from './api';


const FISH_TYPES = [
  'ரூப் (MEDIUM)',
  'சங்கரா (Sankara)',
  'வஞ்சரம் (Vanjaram)',
  'மத்தி (Mathi)',
  'ரூப் (BIG)',
  'இறால் (Prawn)',
  'நெத்திலி (Nethili)',
  'சூரை (Tuna)',
  'கானாங்கெளுத்தி (Mackerel)',
  'ஜிலேபி (BIG)',
  'ஜிலேபி (MEDIUM)',
  'ரூப் (SMALL)',
  'பங்காஸ் (Pangas)',
  'கெண்டை (Kendai)',
  'நண்டு (Crab)',
  'கொடுவா (Koduva)'

];


function App() {
  const getTodayDate = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${dd}-${mm}-${yyyy}`;
  };

  const datePickerRef = useRef<HTMLInputElement>(null);

  const [billNo, setBillNo] = useState<string>('1');

  const [date, setDate] = useState<string>(getTodayDate);

  const [customerName, setCustomerName] = useState('');
  const [address, setAddress] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');

  const [items, setItems] = useState<BillItem[]>(() => [
    { id: Date.now().toString(), particulars: FISH_TYPES[0], qty: '', rate: '', kg: '', quantity: '', price: '' }
  ]);

  const [prevBalance, setPrevBalance] = useState<string>('');
  const [advance, setAdvance] = useState<string>('');

  const [savedCustomers, setSavedCustomers] = useState<Record<string, CustomerData>>(() => {
    const map: Record<string, CustomerData> = {};
    const local = getLocalCustomers();
    const source = (Array.isArray(local) && local.length > 0) ? local : DEFAULT_INITIAL_CUSTOMERS;
    source.forEach(c => {
      if (c && c.name && c.id !== undefined) {
        map[String(c.id)] = { ...c };
      }
    });
    return map;
  });
  const [savedBills, setSavedBills] = useState<SavedBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);

      try {
        const customersData = await getCustomers();
        if (Array.isArray(customersData) && customersData.length > 0) {
          const customerMap: Record<string, CustomerData> = {};
          customersData.forEach(c => {
            if (c && c.name && c.id !== undefined) {
              customerMap[String(c.id)] = { ...c };
            }
          });
          setSavedCustomers(customerMap);
        }
      } catch (custErr) {
        console.warn('Customer load fallback:', custErr);
      }

      try {
        const billsData = await getBills();
        if (Array.isArray(billsData)) {
          setSavedBills(billsData);
          if (billsData.length > 0) {
            const sortedBills = [...billsData].sort((a, b) => (Number(a.billNo) || 0) - (Number(b.billNo) || 0));
            setSavedCustomers(prev => {
              const updated = { ...prev };
              sortedBills.forEach(b => {
                const customer = b.customerId ? updated[b.customerId] : undefined;
                if (customer) {
                  customer.balance = Number(b.finalBalance) || 0;
                }
              });
              return updated;
            });
          }
        }
      } catch (billsErr) {
        console.warn('Bills load fallback:', billsErr);
      }
    } catch (err: any) {
      console.warn('Initial data load warning:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historySearch, setHistorySearch] = useState('');

  const handleWhatsAppShare = () => {
    if (!customerName.trim()) {
      alert("Please select or enter a Customer Name before sharing!");
      return;
    }
    const lines = [
      `*🐟 KKM SEA FOODZ - BILL*`,
      `*Bill No:* ${billNo}`,
      `*Date:* ${date}`,
      `*Customer:* ${customerName}${address ? ' - ' + address : ''}`,
      `-----------------------------`,
      ...items.filter(it => it.particulars && (it.qty || it.quantity)).map((it, idx) => {
        const q = it.quantity !== undefined && it.quantity !== '' ? it.quantity : (it.qty ?? '');
        const r = it.price !== undefined && it.price !== '' ? it.price : (it.rate ?? '');
        const amt = (Number(q) || 0) * (Number(r) || 0);
        return `${idx + 1}. ${it.particulars}: ${q} Box × Rs.${r} = Rs.${formatCurrency(amt)}`;
      }),
      `-----------------------------`,
      `*Current Total:* Rs.${formatCurrency(currentTotal)}`,
      ...(Number(prevBalance) ? [`*Old Balance (முன் பாக்கி):* Rs.${formatCurrency(Number(prevBalance))}`] : []),
      `*Total Amount:* Rs.${formatCurrency(subTotal)}`,
      ...(Number(advance) ? [`*Advance (வரவு):* Rs.${formatCurrency(Number(advance))}`] : []),
      `*Final Balance (மீதி பாக்கி):* Rs.${formatCurrency(finalBalance)}`,
      `-----------------------------`,
      `_நன்றி! மீண்டும் வருக!_`
    ];
    const text = encodeURIComponent(lines.join('\n'));
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const handleExportCSV = () => {
    if (savedBills.length === 0) {
      alert("No bills to export!");
      return;
    }
    const headers = ["Bill No", "Date", "Customer Name", "Address", "Total Amount", "Advance", "Final Balance"];
    const rows = savedBills.map(b => [
      `"${b.billNo}"`,
      `"${formatDisplayDate(b.date)}"`,
      `"${(b.customerName || '').replace(/"/g, '""')}"`,
      `"${(b.address || '').replace(/"/g, '""')}"`,
      b.totalAmount,
      b.advance !== undefined ? b.advance : (b.receipt || 0),
      b.finalBalance
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `KKM_Bills_${getTodayDate()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };


  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentCustomerKey, setPaymentCustomerKey] = useState('');
  const [paymentAmount, setPaymentAmount] = useState<string>('');

  const loadBill = (bill: SavedBill) => {
    setDate(formatDateToDMY(bill.date));
    setCustomerName(bill.customerName);
    setAddress(bill.address);
    setSelectedCustomerId(bill.customerId || '');
    setItems(bill.items.map(it => ({
      ...it,
      qty: it.quantity !== undefined ? it.quantity : (it.qty !== undefined ? it.qty : ''),
      rate: it.price !== undefined ? it.price : (it.rate !== undefined ? it.rate : ''),
      quantity: it.quantity !== undefined ? it.quantity : (it.qty !== undefined ? it.qty : ''),
      price: it.price !== undefined ? it.price : (it.rate !== undefined ? it.rate : '')
    })));
    setPrevBalance(String(bill.previousBalance ?? bill.prevBalance ?? ''));
    setAdvance(String(bill.advance ?? bill.receipt ?? ''));
    setBillNo(bill.billNo || '1');
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


  const billPreviewRef = useRef<HTMLDivElement>(null);

  const handleCustomerSelect = (customerId: string) => {
    setSelectedCustomerId(customerId);
    const customer = savedCustomers[customerId];
    if (!customer) {
      setCustomerName('');
      setAddress('');
      setPrevBalance('');
      return;
    }
    setCustomerName(customer.name);
    setAddress(customer.address || '');
    setPrevBalance(customer.balance === 0 ? '' : String(customer.balance));

    const customerBills = savedBills.filter(b => b.customerId === customerId || (customer.name && b.customerName === customer.name));
    const maxBillNo = customerBills.reduce((max, b) => Math.max(max, Number(b.billNo) || 0), Number(customer.lastBillNo) || 0);
    setBillNo(String(maxBillNo + 1));
  };

  const handleManualEdit = (newName: string, newAddress: string) => {
    setCustomerName(newName);
    setAddress(newAddress);
    const trimmedName = newName.trim();
    const trimmedAddr = newAddress.trim();

    const matchedKey = Object.keys(savedCustomers).find(k => {
      const c = savedCustomers[k];
      const nameMatch = c.name.trim() === trimmedName ||
        (trimmedName.includes('SRS') && c.name.includes('SRS'));
      const addrMatch = !trimmedAddr || !c.address || c.address.trim() === trimmedAddr;
      return nameMatch && addrMatch;
    });

    if (matchedKey) {
      setSelectedCustomerId(matchedKey);
      let bal = savedCustomers[matchedKey].balance;

      const hasBillsForCustomer = savedBills.some(b => {
        const bName = (b.customerName || '').trim();
        const bAddr = (b.address || '').trim();
        return (bName === trimmedName || (trimmedName.includes('SRS') && bName.includes('SRS'))) &&
          (!bAddr || !trimmedAddr || bAddr === trimmedAddr);
      });
      if ((!bal || bal === 0) && !hasBillsForCustomer) {
        bal = 0;
      }
      setPrevBalance(bal === 0 ? '' : bal.toString());
    } else {
      setPrevBalance('');
    }
  };

  const addItem = () => {
    setItems([...items, { id: Date.now().toString(), particulars: FISH_TYPES[0], qty: '', rate: '', kg: '', quantity: '', price: '' }]);
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

  const currentTotal = items.reduce((sum, item) => {
    const qty = Number(item.quantity ?? item.qty) || 0;
    const rate = Number(item.price ?? item.rate) || 0;
    return sum + qty * rate;
  }, 0);
  const subTotal = currentTotal + (Number(prevBalance) || 0);
  const finalBalance = subTotal - (Number(advance) || 0);

  const handleSaveBill = async () => {
    if (!customerName.trim() || !address.trim()) {
      alert("Error: Please provide both Customer Name and Address before saving!");
      return;
    }

    let customerId = selectedCustomerId;
    if (!customerId) {
      const trimmedName = customerName.trim();
      const matchedKey = Object.keys(savedCustomers).find(k => {
        const c = savedCustomers[k];
        return c.name.trim().toLowerCase() === trimmedName.toLowerCase();
      });
      if (matchedKey) {
        customerId = matchedKey;
        setSelectedCustomerId(matchedKey);
      } else {
        try {
          const newCust = await createCustomer({
            name: trimmedName,
            address: address.trim(),
            balance: 0
          });
          customerId = String(newCust.id);
          setSelectedCustomerId(customerId);
          setSavedCustomers(prev => ({ ...prev, [customerId]: newCust }));
        } catch (err: any) {
          alert('Error creating customer: ' + err.message);
          return;
        }
      }
    }

    const newBill: SavedBill = {
      customerId,
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
        ...savedCustomers[customerId],
        id: customerId,
        name: customerName,
        address: address,
        balance: saved.finalBalance
      };

      const updatedCustomers = {
        ...savedCustomers,
        [customerId]: updatedCustomer
      };
      setSavedCustomers(updatedCustomers);

      alert(`Bill Saved! ${customerName}'s new balance is Rs.${formatCurrency(saved.finalBalance)}`);


      setDate(getTodayDate());
      setCustomerName('');
      setAddress('');
      setSelectedCustomerId('');
      setPrevBalance('');
      setAdvance('');
      setBillNo(prev => String((Number(prev) || 0) + 1));
      setItems([{ id: Date.now().toString(), particulars: FISH_TYPES[0], qty: '', rate: '', kg: '', quantity: '', price: '' }]);
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
      setDate(getTodayDate());
      setCustomerName('');
      setAddress('');
      setSelectedCustomerId('');
      setPrevBalance('');
      setAdvance('');
      setBillNo(prev => String((Number(prev) || 0) + 1));
      setItems([{ id: Date.now().toString(), particulars: FISH_TYPES[0], qty: '', rate: '', kg: '', quantity: '', price: '' }]);
    }
  };

  const handleSavePayment = async () => {

    const resolvedKey = resolveCustomerKey(paymentCustomerKey);
    if (!resolvedKey || !savedCustomers[resolvedKey]) {
      alert("Please select a valid customer from the list.");
      return;
    }
    const payAmt = Number(paymentAmount) || 0;
    if (payAmt <= 0) {
      alert("Please enter a valid amount greater than 0.");
      return;
    }

    const customer = savedCustomers[resolvedKey];
    const currentBalance = getEffectiveBalance(resolvedKey);
    const newBalance = currentBalance - payAmt;

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
        [resolvedKey]: updatedCustomerData
      };

      setSavedCustomers(updatedCustomers);


      setSavedBills(prev => {
        const customerBills = prev.filter(b => b.customerId === resolvedKey);
        if (customerBills.length === 0) return prev;
        const sorted = [...customerBills].sort((a, b) => (Number(b.billNo) || 0) - (Number(a.billNo) || 0));
        const latestBillNo = sorted[0].billNo;
        return prev.map(b => {
          if (b.customerId === resolvedKey && b.billNo === latestBillNo) return { ...b, finalBalance: newBalance };
          return b;
        });
      });

      alert(`Payment Saved! ${customer.name}'s new balance is Rs.${formatCurrency(newBalance)}`);


      setShowPaymentModal(false);
      setPaymentCustomerKey('');
      setPaymentAmount('');
    } catch (err: any) {
      alert('Error saving payment: ' + err.message);
    }
  };

  const formatCurrency = (num: number) => {
    return num.toLocaleString('en-IN');
  };


  const resolveCustomerKey = (inputKey: string): string | null => {
    if (!inputKey) return null;
    return savedCustomers[inputKey] ? inputKey : null;
  };


  const getEffectiveBalance = (customerKey: string): number => {
    const resolvedKey = resolveCustomerKey(customerKey);
    const customer = resolvedKey ? savedCustomers[resolvedKey] : savedCustomers[customerKey];
    if (!customer) return 0;


    if (customer.balance && customer.balance !== 0) return customer.balance;


    const customerId = String(customer.id || resolvedKey || customerKey);
    const customerBills = savedBills.filter(b => b.customerId === customerId);

    if (customerBills.length === 0) return 0;


    const sortedBills = [...customerBills].sort((a, b) => (Number(b.billNo) || 0) - (Number(a.billNo) || 0));
    const latestBillBalance = Number(sortedBills[0].finalBalance) || 0;


    if (latestBillBalance !== 0) return latestBillBalance;
    return 0;
  };

  const selectedCustomer = savedCustomers[selectedCustomerId];

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
              <input
                type="text"
                value={billNo}
                onChange={e => setBillNo(e.target.value)}
                placeholder="Enter Bill No"
                style={{ fontWeight: 'bold' }}
              />
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
              <select
                value={selectedCustomerId}
                onChange={e => handleCustomerSelect(e.target.value)}
                style={{ backgroundColor: '#e9ecef', border: '2px solid #0b4b8a' }}
              >
                <option value="">Select a customer...</option>
                {(() => {
                  const seen = new Set<string>();
                  const entries = Object.entries(savedCustomers);
                  const list = entries.length > 0
                    ? entries.map(([id, customer]) => ({ id, ...customer }))
                    : DEFAULT_INITIAL_CUSTOMERS.map(c => ({ id: String(c.id), ...c }));

                  return list
                    .filter(c => c && c.name)
                    .sort((a, b) => `${a.name || ''} - ${a.address || ''}`.localeCompare(`${b.name || ''} - ${b.address || ''}`))
                    .filter(c => {
                      const key = (c.name || '').trim().toLowerCase();
                      if (seen.has(key)) return false;
                      seen.add(key);
                      return true;
                    })
                    .map(c => (
                      <option key={c.id} value={String(c.id)}>{c.name} - {c.address}</option>
                    ));
                })()}
              </select>
              {((Number(prevBalance) || 0) > 0 || (selectedCustomer && selectedCustomer.balance !== 0)) && (
                <div style={{ marginTop: '10px', color: '#842029', fontWeight: 'bold', fontSize: '1.1em', padding: '10px', backgroundColor: '#f8d7da', border: '1px solid #f5c2c7', borderRadius: '5px' }}>
                  ⚠️ This customer has a Previous Balance (முன் பாக்கி) of: Rs. {formatCurrency(Number(prevBalance) || selectedCustomer?.balance || 0)}
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
              <label>Advance (வரவு)</label>
              <input type="number" value={advance} onChange={e => setAdvance(e.target.value)} placeholder="0" />
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          <button className="btn" style={{ backgroundColor: '#0d6efd', color: 'white' }} onClick={handleSaveBill}>💾 Save & Next Bill</button>
          <button className="btn" style={{ backgroundColor: '#198754', color: 'white' }} onClick={handlePrint}>🖨️ Print / PDF</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
          <button className="btn" style={{ backgroundColor: '#25D366', color: 'white', fontWeight: 'bold' }} onClick={handleWhatsAppShare} title="Share Bill on WhatsApp">💬 WhatsApp</button>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '8px' }}>
              <h2 style={{ margin: 0, color: '#0b4b8a', borderBottom: 'none' }}>📜 Previous Bills History</h2>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  className="btn"
                  style={{ backgroundColor: '#198754', color: '#fff', fontSize: '13px', padding: '6px 12px' }}
                  onClick={handleExportCSV}
                  title="Export all bills to Excel CSV"
                >
                  📊 Export Excel / CSV
                </button>
                <button className="btn btn-danger" style={{ padding: '6px 12px' }} onClick={() => setShowHistoryModal(false)}>Close</button>
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <input
                type="text"
                placeholder="🔍 Search by Customer Name, Bill No, or Date..."
                value={historySearch}
                onChange={e => setHistorySearch(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '14px' }}
              />
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
                  {savedBills.filter(bill => {
                    if (!historySearch.trim()) return true;
                    const q = historySearch.trim().toLowerCase();
                    return String(bill.billNo || '').toLowerCase().includes(q)
                      || (bill.customerName || '').toLowerCase().includes(q)
                      || (bill.address || '').toLowerCase().includes(q)
                      || (bill.date || '').toLowerCase().includes(q);
                  }).slice().sort((a, b) => {
                    const customerCompare = `${a.customerName} - ${a.address}`.localeCompare(`${b.customerName} - ${b.address}`);
                    return customerCompare
                      || String(a.customerId || '').localeCompare(String(b.customerId || ''))
                      || (Number(a.billNo) || 0) - (Number(b.billNo) || 0);
                  }).map((bill, index) => (
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
              <select value={paymentCustomerKey} onChange={e => setPaymentCustomerKey(e.target.value)}>
                <option value="">Select a customer...</option>
                {(() => {
                  const seen2 = new Set<string>();
                  const entries = Object.entries(savedCustomers);
                  const list = entries.length > 0
                    ? entries.map(([id, customer]) => ({ id, ...customer }))
                    : DEFAULT_INITIAL_CUSTOMERS.map(c => ({ id: String(c.id), ...c }));

                  return list
                    .filter(c => c && c.name)
                    .sort((a, b) => `${a.name || ''} - ${a.address || ''}`.localeCompare(`${b.name || ''} - ${b.address || ''}`))
                    .filter(c => {
                      const key = (c.name || '').trim().toLowerCase();
                      if (seen2.has(key)) return false;
                      seen2.add(key);
                      return true;
                    })
                    .map(c => (
                      <option key={c.id} value={String(c.id)}>{c.name} - {c.address}</option>
                    ));
                })()}
              </select>
            </div>

            {(() => {
              const resolvedKey = resolveCustomerKey(paymentCustomerKey);
              if (!paymentCustomerKey || !resolvedKey) return null;
              const effectiveBal = getEffectiveBalance(resolvedKey);
              return (
                <div style={{ backgroundColor: effectiveBal > 0 ? '#fff3cd' : '#d1e7dd', padding: '10px', borderRadius: '5px', marginBottom: '1rem', border: `1px solid ${effectiveBal > 0 ? '#ffc107' : '#0f5132'}` }}>
                  <p style={{ margin: 0, color: effectiveBal > 0 ? '#856404' : '#0f5132', fontWeight: 'bold', fontSize: '1.05rem' }}>
                    {effectiveBal > 0 ? '⚠️' : '✅'} Current Pending Balance: Rs. {formatCurrency(effectiveBal)}
                  </p>

                </div>
              );
            })()}

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
            <span style={{ display: 'inline-block', lineHeight: '1.6', textAlign: 'left' }}>
              <span style={{ display: 'flex', gap: '4px' }}>
                <span style={{ whiteSpace: 'nowrap' }}>Mobile:</span>
                9787178910<br />8695172090
              </span>
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '10px 0' }}>
            <img src={logoImg} alt="Logo Left" style={{ width: '70px', height: '70px', objectFit: 'contain', borderRadius: '50%' }} />
            <div style={{ textAlign: 'center', flex: 1 }}>
              <h1 style={{ margin: '0 0 5px 0' }}>KKM SEA FOODS</h1>
              <h2 style={{ margin: 0, padding: 0, border: 'none' }}>FISH COMMISSION AGENT</h2>
            </div>
            <img src={logoImg} alt="Logo Right" style={{ width: '70px', height: '70px', objectFit: 'contain', borderRadius: '50%' }} />
          </div>
          <p><b>No.165, MURUGAN KOVIL STREET , MALAIYARASANKUPPAM,605701</b></p>
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
              <th style={{ width: '8%' }}>SL No.</th>
              <th style={{ width: '40%' }}>Particulars</th>
              <th style={{ width: '12%' }}>Qty<br /><small>Box</small></th>
              <th style={{ width: '18%' }}>Rate<br /><small>Rs.</small></th>
              <th style={{ width: '22%' }}>Amount<br /><small>Rs.</small></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={item.id}>
                <td className="text-center">{index + 1}</td>
                <td>{item.particulars}</td>
                <td className="text-center">{item.qty}</td>
                <td className="text-center">{item.rate || item.price}</td>
                <td className="font-bold" style={{ textAlign: 'right' }}>
                  {formatCurrency((Number(item.quantity ?? item.qty) || 0) * (Number(item.price ?? item.rate) || 0))}
                </td>
              </tr>
            ))}

            {/* Previous Balance Row */}
            <tr>
              <td colSpan={4} className="text-right font-bold" style={{ color: 'blue' }}>முன் பாக்கி =&gt;</td>
              <td className="font-bold" style={{ textAlign: 'right' }}>{formatCurrency(Number(prevBalance) || 0)}</td>
            </tr>

            {/* Subtotal Row */}
            <tr>
              <td colSpan={4}></td>
              <td className="font-bold" style={{ textAlign: 'right' }}>{formatCurrency(subTotal)}</td>
            </tr>

            {/* Advance Row */}
            <tr>
              <td colSpan={4} className="text-right font-bold" style={{ color: 'blue' }}>Advance (வரவு) =&gt;</td>
              <td className="font-bold" style={{ textAlign: 'right' }}>{formatCurrency(Number(advance) || 0)}</td>
            </tr>

            {/* Final Balance Row */}
            <tr>
              <td colSpan={1} rowSpan={3} style={{ verticalAlign: 'bottom', borderRight: 'none' }}>
                <b>Thank You!</b>
              </td>
              <td colSpan={3} className="font-bold">Total Amount</td>
              <td className="font-bold" style={{ textAlign: 'right' }}>{formatCurrency(subTotal)}</td>
            </tr>
            <tr>
              <td colSpan={3} className="font-bold">Advance</td>
              <td className="font-bold" style={{ textAlign: 'right' }}>{formatCurrency(Number(advance) || 0)}</td>
            </tr>
            <tr>
              <td colSpan={3} className="font-bold">Balance</td>
              <td className="font-bold" style={{ textAlign: 'right' }}>{formatCurrency(finalBalance)}</td>
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
