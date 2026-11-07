-- A case now exists before it is paid. The webhook moves it to awaiting_lawyer once Paystack confirms payment.
alter type case_status add value if not exists 'pending_payment' before 'awaiting_lawyer';
