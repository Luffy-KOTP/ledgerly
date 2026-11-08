-- Full complaint lifecycle. (Separate file: new enum values cannot be used in the same transaction that adds them.)
alter type complaint_status add value if not exists 'received' after 'pending';
alter type complaint_status add value if not exists 'under_review' after 'received';
alter type complaint_status add value if not exists 'awaiting_customer' after 'in_progress';
alter type complaint_status add value if not exists 'responded' after 'awaiting_customer';
alter type complaint_status add value if not exists 'resolution_proposed' after 'responded';
alter type complaint_status add value if not exists 'closed';
